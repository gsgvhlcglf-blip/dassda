import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { join } from "node:path";
import { randomUUID, createHmac } from "node:crypto";
import { testAppServer } from "./test-app-server.mjs";
const key = "TEST-ONLY-KEY-NOT-A-CREDENTIAL",
  salt = "TEST-ONLY-SALT",
  app = await testAppServer({
    PAYTR_MERCHANT_ID: "TEST-ONLY",
    PAYTR_MERCHANT_KEY: key,
    PAYTR_MERCHANT_SALT: salt,
    NEXT_PUBLIC_SITE_URL: "https://merchant.example.test",
  }),
  browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
try {
  const admin = await browser.newContext(),
    member = await browser.newContext(),
    other = await browser.newContext(),
    origin = app.origin;
  assert.equal(
    (
      await other.request.post(origin + "/api/payments/start", { data: {} })
    ).status(),
    401,
  );
  assert.equal(
    (await other.request.get(origin + "/api/admin/payments")).status(),
    403,
  );
  assert.equal(
    (
      await other.request.get(
        origin + "/api/payments/status?id=" + randomUUID(),
      )
    ).status(),
    401,
  );
  await admin.request.post(origin + "/api/auth", {
    data: { email: "demo@local.test", password: app.password },
  });
  let response = await admin.request.post(origin + "/api/admin/payments", {
    data: { provider: "paytr", mode: "test", enabled: true },
  });
  assert(response.ok(), await response.text());
  const settings = await (
    await admin.request.get(origin + "/api/admin/payments")
  ).json();
  assert(!JSON.stringify(settings).includes(key));
  assert(!JSON.stringify(settings).includes(salt));
  assert.equal(
    (await (await member.request.get(origin + "/api/payments/config")).json())
      .ready,
    true,
  );
  const input = {
    customer_name: "Payment Test",
    email: "ignored@example.test",
    phone: "05000000000",
    address: "Test street 10 sample address",
    note: "",
    consent: true,
    locale: "tr",
    lines: [{ productId: "p1", variantId: "p1-gloss", quantity: 1 }],
  };
  const created = await (
    await member.request.post(origin + "/api/orders", { data: input })
  ).json();
  assert(created.reference);
  const db = new DatabaseSync(join(app.directory, ".data/store.sqlite")),
    order = db
      .prepare("SELECT * FROM orders WHERE reference=?")
      .get(created.reference),
    id = randomUUID(),
    ref = "KZ" + id.replaceAll("-", ""),
    now = new Date().toISOString();
  // Upgrade a real legacy NOT NULL schema without losing its order, attempt or audit event.
  const legacyCustomer = randomUUID(),
    legacyAttempt = randomUUID();
  db.prepare("INSERT INTO customers VALUES(?,?,?)").run(
    legacyCustomer,
    "legacy-fixture@example.test",
    "TEST-ONLY-DISABLED-HASH",
  );
  db.prepare(
    "INSERT INTO orders(id,reference,customer_id,customer_name,email,phone,address,note,status,total,currency,demo,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)",
  ).run(
    "legacy-order",
    "KZ-LEGACY-FIXTURE",
    legacyCustomer,
    "Legacy Fixture",
    "legacy-fixture@example.test",
    "05000000000",
    "Legacy test address 10",
    "",
    "demo_request",
    10,
    "TRY",
    1,
    now,
  );
  const legacyDDL = db
    .prepare("SELECT sql FROM sqlite_master WHERE name='payment_attempts'")
    .get().sql;
  db.exec("PRAGMA foreign_keys=OFF; DROP TABLE payment_attempts");
  db.exec(
    legacyDDL.replace(
      "customer_id TEXT REFERENCES",
      "customer_id TEXT NOT NULL REFERENCES",
    ),
  );
  db.prepare(
    "INSERT INTO payment_attempts VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
  ).run(
    legacyAttempt,
    "legacy-order",
    legacyCustomer,
    "paytr",
    "test",
    "failed",
    1000,
    "TRY",
    "KZlegacyfixture",
    null,
    null,
    null,
    0,
    now,
    now,
    null,
  );
  db.prepare("INSERT INTO payment_events VALUES(?,?,?,?)").run(
    "legacy-event",
    legacyAttempt,
    "created",
    now,
  );
  db.exec("PRAGMA foreign_keys=ON");
  assert.equal(
    (await member.request.get(origin + "/api/payments/config")).status(),
    200,
  );
  assert.equal(
    db
      .prepare("SELECT customer_id FROM payment_attempts WHERE id=?")
      .get(legacyAttempt).customer_id,
    legacyCustomer,
  );
  assert.equal(
    db
      .prepare("SELECT attempt_id FROM payment_events WHERE id='legacy-event'")
      .get().attempt_id,
    legacyAttempt,
  );
  assert.equal(db.prepare("PRAGMA foreign_key_check").all().length, 0);
  assert.equal(
    db
      .prepare("PRAGMA table_info(payment_attempts)")
      .all()
      .find((c) => c.name === "customer_id").notnull,
    0,
  );
  db.prepare(
    "INSERT INTO payment_attempts VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
  ).run(
    id,
    order.id,
    order.customer_id,
    "paytr",
    "test",
    "ready",
    Math.round(order.total * 100),
    "TRY",
    ref,
    "testtoken1234567890",
    "https://www.paytr.com/odeme/guvenli/testtoken1234567890",
    null,
    0,
    now,
    new Date(Date.now() + 1800000).toISOString(),
    null,
  );
  db.prepare(
    "UPDATE orders SET payment_status='pending',payment_provider='paytr' WHERE id=?",
  ).run(order.id);
  const before = db
    .prepare("SELECT stock FROM products WHERE id='p1'")
    .get().stock;
  const callback = {
    merchant_oid: ref,
    status: "success",
    total_amount: String(Math.round(order.total * 100)),
    test_mode: "1",
    hash: "forged",
  };
  response = await other.request.post(origin + "/api/payments/paytr/callback", {
    form: callback,
  });
  assert.equal(response.status(), 400);
  assert.equal(
    db.prepare("SELECT payment_status FROM orders WHERE id=?").get(order.id)
      .payment_status,
    "pending",
  );
  callback.hash = createHmac("sha256", key)
    .update(ref + salt + "success" + callback.total_amount)
    .digest("base64");
  for (let i = 0; i < 2; i++) {
    response = await other.request.post(
      origin + "/api/payments/paytr/callback",
      { form: callback },
    );
    assert.equal(await response.text(), "OK");
  }
  assert.equal(
    db.prepare("SELECT payment_status FROM orders WHERE id=?").get(order.id)
      .payment_status,
    "test_paid",
  );
  assert.equal(
    db.prepare("SELECT stock FROM products WHERE id='p1'").get().stock,
    before,
  );
  assert.equal(
    db
      .prepare("SELECT count(*) n FROM payment_events WHERE attempt_id=?")
      .get(id).n,
    1,
  );
  const receipt = await (
    await member.request.get(origin + "/api/payments/status?id=" + id)
  ).json();
  assert.equal(receipt.state, "test_paid");
  assert.equal("token" in receipt, false);
  await other.request.post(origin + "/api/orders", {
    data: { ...input, email: "same-guest@example.test" },
  });
  assert.equal(
    (
      await other.request.get(origin + "/api/payments/status?id=" + id)
    ).status(),
    404,
  );
  const falseSuccess = await member.request.get(
    origin + "/api/payments/status?id=" + id + "&success=true",
  );
  assert.equal((await falseSuccess.json()).state, "test_paid");
  assert.equal(
    (
      await admin.request.post(origin + "/api/admin/payments", {
        data: { provider: "paytr", mode: "live", enabled: true },
      })
    ).status(),
    400,
  );
  // Browser gateway responses below are explicit fixtures; no provider is contacted.
  const shopOrigin = origin;
  const page = await member.newPage(),
    fakeId = randomUUID();
  let orderPayload, startPayload;
  await page.route("**/api/orders", async (route) => {
    orderPayload = route.request().postDataJSON();
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ reference: "KZ-browserfixture", demo: true }),
    });
  });
  await page.route("**/api/payments/start", async (route) => {
    startPayload = route.request().postDataJSON();
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        id: fakeId,
        provider: "paytr",
        mode: "test",
        state: "ready",
        checkoutUrl: "https://www.paytr.com/odeme/guvenli/testtoken1234567890",
      }),
    });
  });
  await page.route("https://www.paytr.com/odeme/guvenli/**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<html><body><h1>TEST GATEWAY FIXTURE</h1></body></html>",
    }),
  );
  await page.goto(shopOrigin + "/urunler/karbon-on-camurluk");
  await page.getByRole("button", { name: "Sepete ekle", exact: true }).click();
  await page.goto(shopOrigin + "/odeme");
  const fill = async () => {
    await page.getByLabel("Ad soyad", { exact: true }).fill("Browser Test");
    await page
      .getByLabel("E-posta", { exact: true })
      .fill("browser@example.test");
    await page.getByLabel("Telefon", { exact: true }).fill("05000000000");
    await page
      .getByLabel("Teslimat adresi", { exact: true })
      .fill("Browser test address number 10");
    await page.getByLabel("Verilerimin").check();
  };
  await fill();
  await page
    .getByRole("button", { name: "PayTR ile ödemeye geç", exact: true })
    .click();
  await page
    .frameLocator("iframe.payment-gateway-frame")
    .getByRole("heading", { name: "TEST GATEWAY FIXTURE" })
    .waitFor();
  assert.equal("buyer_identity" in orderPayload, false);
  assert.equal(startPayload.reference, "KZ-browserfixture");
  // Fixture navigation is initiated by the local merchant parent, preserving
  // browser private-network protection while testing the real return bridge.
  await page.locator("iframe.payment-gateway-frame").evaluate(
    (iframe, url) => {
      iframe.src = url;
    },
    shopOrigin + "/odeme/donus?attempt=" + fakeId + "&success=true",
  );
  await page.waitForURL("**/odeme/sonuc?attempt=" + fakeId);

  await page.locator(".form-error[role=alert]").waitFor();
  assert(
    !(await page
      .getByRole("heading", { name: "Ödeme doğrulandı", exact: true })
      .count()),
  );
  // Opening an older verified receipt must not erase a newer shopping cart.
  await page.goto(shopOrigin + "/odeme/sonuc?attempt=" + id);
  await page
    .getByRole("heading", { name: "Test ödemesi doğrulandı", exact: true })
    .waitFor();
  await page.goto(shopOrigin + "/sepet");
  assert.equal(await page.locator(".cart-line").count(), 1);
  await page.evaluate(() => sessionStorage.clear());
  await page.route("**/api/payments/config", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        provider: "iyzico",
        mode: "test",
        enabled: true,
        ready: true,
      }),
    }),
  );
  await page.unroute("**/api/payments/start");
  await page.route("**/api/payments/start", async (route) => {
    startPayload = route.request().postDataJSON();
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        id: randomUUID(),
        provider: "iyzico",
        mode: "test",
        state: "ready",
        checkoutUrl: "https://sandbox-cpp.iyzipay.com?token=testfixture",
      }),
    });
  });
  await page.route("https://sandbox-cpp.iyzipay.com/**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<html><body>IYZICO TEST FIXTURE</body></html>",
    }),
  );
  await page.goto(shopOrigin + "/odeme");
  await fill();
  await page.getByLabel("Şehir", { exact: true }).fill("Test City");
  await page.getByLabel("Ülke", { exact: true }).fill("Turkey");
  await page
    .getByLabel("T.C. kimlik / pasaport numarası", { exact: true })
    .fill("TESTPASSPORT");
  await page
    .getByRole("button", { name: "iyzico ile ödemeye geç", exact: true })
    .click();
  await page.waitForURL("https://sandbox-cpp.iyzipay.com/**");
  assert.equal(startPayload.identity, "TESTPASSPORT");
  assert.equal("buyer_identity" in orderPayload, false);
  assert(
    !JSON.stringify(
      db.prepare("SELECT * FROM payment_attempts").all(),
    ).includes("TESTPASSPORT"),
  );
  db.close();
  console.log(
    "Hosted UI fixtures passed: PayTR iframe/return, unverified success rejection, cart protection, iyzico redirect and ephemeral identity.",
  );
  console.log(
    "Payment app passed: settings protection, no exposed secrets, invalid signature rejection, signed callback, duplicate no-op, test-mode stock safety, private receipts and disabled local live mode.",
  );
} finally {
  await browser.close();
  await app.stop();
}
