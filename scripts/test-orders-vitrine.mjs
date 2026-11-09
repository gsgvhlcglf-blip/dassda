import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { join } from "node:path";
import { testAppServer } from "./test-app-server.mjs";
import { dismissCookies } from "./test-cookie-helper.mjs";

const key = "kuzmin.workspace.gsgvhlcglf-blip.dassda.v1";
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
const staticServer = createServer((req, res) => {
  const path = new URL(req.url, "http://localhost").pathname;
  if (!/^\/docs\/(panel\.html|store\.html|panel-version\.json)$/.test(path))
    return res.writeHead(404).end();
  res.setHeader(
    "Content-Type",
    path.endsWith("json") ? "application/json" : "text/html; charset=utf-8",
  );
  res.end(readFileSync("." + path));
});
await new Promise((resolve) => staticServer.listen(0, "127.0.0.1", resolve));
let app;
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1100 },
    permissions: ["clipboard-read", "clipboard-write"],
  });
  const initial = JSON.parse(
    readFileSync("docs/panel.html", "utf8").match(
      /const INITIAL = (\{[^\n]*\});/,
    )[1],
  );
  initial.content = initial.content.filter(
    (row) => row.key !== "home-bestsellers",
  );
  initial.products[0].price = 7311;
  await context.addInitScript(
    ({ key, initial }) => {
      if (!localStorage.getItem(key))
        localStorage.setItem(key, JSON.stringify(initial));
    },
    { key, initial },
  );
  const page = await context.newPage(),
    errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(
    `http://127.0.0.1:${staticServer.address().port}/docs/panel.html#onizleme`,
  );
  const frame = () => page.frameLocator("#site-frame");
  await dismissCookies(frame());
  await expect(frame().locator(".home-bestsellers")).toBeVisible();
  await expect(frame().locator(".bestseller-card")).toHaveCount(3);
  const positions = await frame()
    .locator(".home-brands")
    .evaluate((element) => ({
      brand: element.getBoundingClientRect().bottom,
      best: document.querySelector(".home-bestsellers").getBoundingClientRect()
        .top,
      bottom: document
        .querySelector(".home-bestsellers")
        .getBoundingClientRect().bottom,
      quote: document.querySelector(".home-custom").getBoundingClientRect().top,
    }));
  assert(
    positions.brand <= positions.best && positions.bottom <= positions.quote,
  );
  await page.getByRole("button", { name: "Veri paneli", exact: true }).click();
  await page
    .locator(".nav")
    .getByRole("button", { name: "En çok satanlar", exact: true })
    .click();
  const picks = page.locator(".bestsellers-picker input[type=checkbox]"),
    count = Math.min(10, await picks.count());
  assert(count >= 4);
  for (let index = 0; index < count; index++) await picks.nth(index).check();
  if ((await picks.count()) > 10) await expect(picks.nth(10)).toBeDisabled();
  await page.getByLabel("Karusel geçiş süresi").selectOption("3");
  await page
    .getByRole("button", { name: "Vitrini kaydet", exact: true })
    .click();
  await expect(
    page.locator(".bestsellers-settings").getByRole("status"),
  ).toContainText("Kaydedildi");
  await page
    .locator(".nav")
    .getByRole("button", { name: "Sayfa önizlemeleri", exact: true })
    .click();
  await page.locator("#site-inspect").uncheck();
  await dismissCookies(frame());
  await expect(frame().locator(".bestseller-card")).toHaveCount(count);
  await page.mouse.move(0, 0);
  await expect
    .poll(
      () =>
        frame()
          .locator(".bestsellers-rail")
          .evaluate((rail) => rail.scrollLeft),
      { timeout: 12000 },
    )
    .toBeGreaterThan(0);
  assert.equal(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)).products[0].price,
      key,
    ),
    7311,
  );
  await page.locator("#site-inspect").check();
  await frame().locator(".bestseller-image-binding").first().click();
  await expect(page.getByLabel("Vitrin görsel ölçeği")).toBeVisible();
  await page.getByLabel("Vitrin görsel ölçeği").evaluate((input) => {
    input.value = "150";
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await page.getByRole("button", { name: "Veri paneli", exact: true }).click();
  await page
    .locator(".nav")
    .getByRole("button", { name: "Siparişler", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Örnek sipariş ekle", exact: true })
    .click();
  await page.getByRole("button", { name: "DEMO-KZ-0001", exact: true }).click();
  await expect(page.locator(".order-detail-heading")).toContainText(
    "Sipariş hazırlanıyor",
  );
  await expect(page.locator(".order-detail-grid").first()).toContainText(
    "ornek@example.test",
  );
  await page.getByLabel("Sipariş kargo takip numarası").fill("DEMO-TRACK-123");
  await page
    .getByRole("button", { name: "Kargo takip numarasını paylaş", exact: true })
    .click();
  await expect(page.locator(".order-detail-heading")).toContainText(
    "Siparişiniz kargoya verildi",
  );
  await page
    .getByRole("button", { name: "Takip mesajını kopyala", exact: true })
    .click();
  assert(
    (await page.evaluate(() => navigator.clipboard.readText())).includes(
      "DEMO-TRACK-123",
    ),
  );
  await page.reload();
  if (
    await page.getByRole("button", { name: "Veri paneli", exact: true }).count()
  )
    await page
      .getByRole("button", { name: "Veri paneli", exact: true })
      .click();
  await page
    .locator(".nav")
    .getByRole("button", { name: "Siparişler", exact: true })
    .click();
  await page.getByRole("button", { name: "DEMO-KZ-0001", exact: true }).click();
  await expect(page.getByLabel("Sipariş kargo takip numarası")).toHaveValue(
    "DEMO-TRACK-123",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  assert(
    await page
      .locator("html")
      .evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  );
  await page.screenshot({ path: "/tmp/orders-preview-mobile.png" });
  assert.deepEqual(errors, []);
  await context.close();
  console.log(
    "PASS (preview): restored three-card showcase, ten-product limit, automatic carousel, framing, preserved owner price and clearly marked demo order/tracking persistence.",
  );

  app = await testAppServer();
  const admin = await browser.newContext({
      viewport: { width: 1440, height: 1100 },
    }),
    member = await browser.newContext(),
    outsider = await browser.newContext();
  const origin = app.origin;
  assert.equal(
    (await outsider.request.get(origin + "/api/admin/orders")).status(),
    403,
  );
  await admin.request.post(origin + "/api/auth", {
    data: { email: "demo@local.test", password: app.password },
  });
  for (const [client, email] of [
    [member, "order-owner@example.test"],
    [outsider, "different-owner@example.test"],
  ]) {
    const response = await client.request.post(origin + "/api/customer", {
      data: {
        action: "signup",
        email,
        password: "Test-only-password-123456",
        consent: true,
      },
    });
    assert(response.ok(), await response.text());
  }
  const input = {
    customer_name: "Test Customer",
    email: "ignored@example.test",
    phone: "05000000000",
    address: "Example street 10\nTest city\nTest country",
    note: "Order detail test",
    consent: true,
    locale: "tr",
    lines: [{ productId: "p1", variantId: "p1-gloss", quantity: 2 }],
  };
  const createdResponse = await member.request.post(origin + "/api/orders", {
    data: input,
  });
  assert.equal(createdResponse.status(), 201);
  const created = await createdResponse.json();
  let response = await admin.request.get(origin + "/api/admin/orders");
  assert(response.headers()["cache-control"].includes("no-store"));
  let order = (await response.json()).orders.find(
    (row) => row.reference === created.reference,
  );
  assert(order && order.items.length === 1 && order.items[0].quantity === 2);
  assert.equal(order.email, "order-owner@example.test");
  const adminPage = await admin.newPage(),
    customerPage = await member.newPage();
  await adminPage.goto(origin + "/admin");
  await adminPage
    .getByRole("button", { name: "Siparişler", exact: true })
    .click();
  await adminPage
    .getByRole("button", { name: created.reference, exact: true })
    .click();
  await expect(adminPage.locator(".order-detail-heading")).toContainText(
    "Sipariş hazırlanıyor",
  );
  await expect(adminPage.locator(".order-detail-grid").first()).toContainText(
    "Test city",
  );
  await customerPage.goto(origin + "/hesabim");
  await dismissCookies(customerPage);
  await expect(customerPage.locator(".member-orders")).toContainText(
    "Sipariş hazırlanıyor",
  );
  const shipment = {
    tracking_number: "ORDER-TRACK-123",
    shipping_carrier: "",
    expected_version: 0,
  };
  assert.equal(
    (
      await outsider.request.post(origin + "/api/admin/orders", {
        data: { id: order.id, shipment },
      })
    ).status(),
    403,
  );
  assert.equal(
    (
      await admin.request.post(origin + "/api/admin/orders", {
        headers: { origin: "https://foreign.example.test" },
        data: { id: order.id, shipment },
      })
    ).status(),
    403,
  );
  await adminPage
    .getByLabel("Sipariş kargo takip numarası")
    .fill(shipment.tracking_number);
  await adminPage
    .getByRole("button", { name: "Kargo takip numarasını paylaş", exact: true })
    .click();
  await expect(adminPage.locator(".order-detail-heading")).toContainText(
    "Siparişiniz kargoya verildi",
  );
  await customerPage.reload();
  await dismissCookies(customerPage);
  await expect(customerPage.locator(".member-orders")).toContainText(
    "Siparişiniz kargoya verildi",
  );
  await expect(customerPage.locator(".account-tracking")).toContainText(
    shipment.tracking_number,
  );
  assert.equal(
    (
      await admin.request.post(origin + "/api/admin/orders", {
        data: { id: order.id, shipment },
      })
    ).status(),
    409,
  );
  assert.equal(
    (
      await admin.request.post(origin + "/api/admin/orders", {
        data: {
          id: order.id,
          shipment: { ...shipment, tracking_number: "", expected_version: 1 },
        },
      })
    ).status(),
    400,
  );
  assert.deepEqual(
    (await (await outsider.request.get(origin + "/api/customer")).json())
      .orders,
    [],
  );
  order = (
    await (await admin.request.get(origin + "/api/admin/orders")).json()
  ).orders.find((row) => row.reference === created.reference);
  assert.equal(order.tracking_number, shipment.tracking_number);
  assert.equal(order.fulfillment_version, 1);
  assert.equal(order.total, created.total);
  const second = await (
    await member.request.post(origin + "/api/orders", {
      data: { ...input, customer_name: "Pending Customer" },
    })
  ).json();
  const db = new DatabaseSync(join(app.directory, ".data/store.sqlite"));
  try {
    const pending = db
      .prepare("SELECT id FROM orders WHERE reference=?")
      .get(second.reference);
    db.prepare(
      "UPDATE orders SET payment_provider='iyzico',payment_status='pending' WHERE id=?",
    ).run(pending.id);
    assert.equal(
      (
        await admin.request.post(origin + "/api/admin/orders", {
          data: { id: pending.id, shipment },
        })
      ).status(),
      400,
    );
    assert.equal(
      db
        .prepare("SELECT tracking_number FROM orders WHERE id=?")
        .get(pending.id).tracking_number,
      "",
    );
    db.prepare(
      "UPDATE orders SET payment_status='paid',status='confirmed' WHERE id=?",
    ).run(pending.id);
    assert.equal(
      (
        await admin.request.post(origin + "/api/admin/orders", {
          data: { id: pending.id, shipment },
        })
      ).status(),
      200,
    );
  } finally {
    db.close();
  }
  await adminPage.reload();
  await adminPage
    .getByRole("button", { name: "Siparişler", exact: true })
    .click();
  await adminPage
    .getByRole("button", { name: created.reference, exact: true })
    .click();
  await adminPage.setViewportSize({ width: 390, height: 844 });
  assert(
    await adminPage
      .locator("html")
      .evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  );
  await adminPage.screenshot({ path: "/tmp/orders-app-mobile.png" });
  await admin.close();
  await member.close();
  await outsider.close();
  console.log(
    "PASS (app): automatic order ingestion and complete details, customer tracking, ownership, origin/admin authorization, persistent shipments, version conflicts and pending-payment guard.",
  );
} finally {
  await browser.close();
  if (app) await app.stop();
  staticServer.closeAllConnections();
  await new Promise((resolve) => staticServer.close(resolve));
}
