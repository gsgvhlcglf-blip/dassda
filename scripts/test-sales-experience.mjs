import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { join } from "node:path";
import { testAppServer } from "./test-app-server.mjs";
import { dismissCookies } from "./test-cookie-helper.mjs";
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
const server = createServer((req, res) => {
  const path = new URL(req.url, "http://localhost").pathname;
  if (!/^\/docs\/(panel\.html|store\.html|panel-version\.json)$/.test(path))
    return res.writeHead(404).end();
  res.setHeader(
    "Content-Type",
    path.endsWith("json") ? "application/json" : "text/html;charset=utf-8",
  );
  res.end(readFileSync("." + path));
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
let app;
try {
  const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    }),
    page = await context.newPage(),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(
    `http://127.0.0.1:${server.address().port}/docs/panel.html#onizleme`,
  );
  await dismissCookies(page.frameLocator("#site-frame"));
  await page.locator("#site-inspect").uncheck();
  await page.locator("#site-page").selectOption("product");
  let frame = page.frameLocator("#site-frame");
  await dismissCookies(frame);
  await expect(frame.locator(".purchase-promise")).toContainText("7–15");
  await frame.locator(".gallery-expand").click();
  await expect(frame.locator("dialog")).toBeVisible();
  await frame
    .getByRole("button", { name: "Fotoğrafı büyüt", exact: true })
    .click();
  await expect(frame.locator(".lightbox-controls")).toContainText("150%");
  await frame
    .getByRole("button", { name: "Fotoğrafı kapat", exact: true })
    .click();
  await expect(frame.locator("dialog")).not.toBeVisible();
  await page.getByRole("button", { name: "Mobil", exact: true }).click();
  await dismissCookies(frame);
  await expect(frame.locator(".mobile-purchase")).toBeVisible();
  await frame.locator(".mobile-purchase .button").click();
  await expect(frame.locator(".bag-link")).toContainText("1");
  await frame.locator(".add-row").scrollIntoViewIfNeeded();
  await expect(frame.locator(".mobile-purchase")).not.toBeVisible();
  await frame.locator(".detail-tabs").scrollIntoViewIfNeeded();
  await frame
    .locator(".product-page")
    .evaluate((el) =>
      el.ownerDocument.defaultView.scrollTo(
        0,
        el.offsetTop + el.querySelector(".product-copy").offsetTop + 900,
      ),
    );
  await expect(frame.locator(".mobile-purchase")).toBeVisible();
  assert(
    await frame
      .locator("html")
      .evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  );
  await page.screenshot({
    path: "/tmp/kuzmin-product-mobile.png",
    fullPage: true,
  });
  assert.deepEqual(errors, []);
  await context.close();
  console.log(
    "PASS preview: close-to-price delivery, gallery zoom, mobile sticky CTA, shared cart and no horizontal overflow.",
  );
  app = await testAppServer();
  const origin = app.origin;
  const admin = await browser.newContext(),
    guest = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await admin.request.post(origin + "/api/auth", {
    data: { email: "demo@local.test", password: app.password },
  });
  await admin.request.post(origin + "/api/admin/analytics", {
    data: { action: "settings", enabled: true, retentionDays: 30 },
  });
  const customer = await guest.newPage(),
    posted = [];
  customer.on("request", (req) => {
    if (req.url().endsWith("/api/analytics") && req.method() === "POST")
      posted.push(req.postDataJSON());
  });
  await customer.goto(
    origin +
      "/urunler/karbon-on-camurluk?brand=yamaha&model=yamaha-mt-25&range=2022-2026",
  );
  await customer.getByRole("button", { name: "Kabul et", exact: true }).click();
  await expect(customer.locator(".product-fitment")).toHaveAttribute(
    "data-fitment",
    "full",
  );
  await expect(customer.locator(".product-fitment")).toContainText(
    "YAMAHA MT-25",
  );
  await customer.locator(".mobile-purchase .button").click();
  await customer.getByRole("link", { name: "Sepet (1)", exact: true }).click();
  await customer
    .getByRole("link", { name: "Ödeme yapın", exact: true })
    .click();
  await expect(customer.locator(".checkout-form")).toBeVisible();
  await customer
    .getByLabel("E-posta", { exact: true })
    .fill("private-fixture@example.test");
  await expect
    .poll(
      () =>
        posted
          .flatMap((b) => b.events)
          .filter((e) => e.kind === "checkout_start").length,
      { timeout: 10000 },
    )
    .toBe(1);
  assert(!JSON.stringify(posted).includes("private-fixture"));
  const checkout = posted
    .flatMap((b) => b.events)
    .find((e) => e.kind === "checkout_start");
  assert.equal(checkout.path, "/odeme");
  assert.equal(checkout.x, null);
  assert.equal(checkout.y, null);
  assert.equal(checkout.depth, null);
  assert.equal(checkout.referrer_host, "");
  assert(
    !posted
      .flatMap((b) => b.events)
      .some((e) => e.path === "/odeme" && e.kind !== "checkout_start"),
  );
  const analytics = await admin.request.get(
    origin + "/api/admin/analytics?days=7",
  );
  assert.equal(analytics.status(), 200, await analytics.text());
  assert.deepEqual((await analytics.json()).report.purchase.counts, [1, 1, 1]);
  assert.equal(
    (
      await guest.request.get(origin + "/api/admin/notifications?order=private")
    ).status(),
    403,
  );
  const created = await (
    await guest.request.post(origin + "/api/orders", {
      data: {
        customer_name: "TEST Fixture",
        email: "fixture@example.test",
        phone: "05000000000",
        address: "Fixture address 10",
        note: "",
        consent: true,
        locale: "tr",
        lines: [{ productId: "p1", variantId: "p1-gloss", quantity: 1 }],
      },
    })
  ).json();
  const db = new DatabaseSync(join(app.directory, ".data/store.sqlite"));
  await admin.request.get(origin + "/api/admin/orders");
  const order = db
    .prepare("SELECT id FROM orders WHERE reference=?")
    .get(created.reference);
  assert(order);
  db.prepare(
    "UPDATE orders SET demo=0,payment_status='paid',status='confirmed' WHERE id=?",
  ).run(order.id);
  let notice = await (
    await admin.request.get(
      origin + "/api/admin/notifications?order=" + order.id,
    )
  ).json();
  assert.equal(notice.ready, false);
  assert.equal(notice.notices.length, 1);
  assert.equal(notice.notices[0].status, "pending");
  const shared = await admin.request.post(origin + "/api/admin/orders", {
    data: {
      id: order.id,
      shipment: {
        tracking_number: "FIXTURE-TRACK-123",
        shipping_carrier: "",
        expected_version: 0,
      },
    },
  });
  assert.equal(shared.status(), 200, await shared.text());
  notice = await (
    await admin.request.get(
      origin + "/api/admin/notifications?order=" + order.id,
    )
  ).json();
  assert.equal(notice.notices.length, 2);
  assert(notice.notices.every((n) => n.status === "pending"));
  assert.equal(
    (
      await admin.request.post(origin + "/api/admin/notifications", {
        data: { order: order.id },
      })
    ).status(),
    409,
  );
  const totals = await (
    await admin.request.get(origin + "/api/admin/analytics?days=7")
  ).json();
  assert.equal(totals.report.purchase.orders.paid, 1);
  assert.equal(totals.report.purchase.orders.created, 1);
  assert(!JSON.stringify(totals).includes("fixture@example.test"));
  db.close();
  await guest.close();
  await admin.close();
  console.log(
    "PASS app: selected motorcycle, guest checkout, consent-only form-free checkout analytics, actual paid-order aggregates, private durable notification queue and honest disabled-email state.",
  );
} finally {
  await browser.close();
  if (app) await app.stop();
  server.closeAllConnections();
  await new Promise((r) => server.close(r));
}
