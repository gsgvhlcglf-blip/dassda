import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { join } from "node:path";
import { testAppServer } from "./test-app-server.mjs";
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
    path.endsWith("json") ? "application/json" : "text/html;charset=utf-8",
  );
  res.end(readFileSync("." + path));
});
await new Promise((r) => staticServer.listen(0, "127.0.0.1", r));
let app;
try {
  const preview = await browser.newContext({
      viewport: { width: 1440, height: 1050 },
    }),
    page = await preview.newPage(),
    calls = [];
  page.on("request", (r) => {
    if (r.url().includes("/api/")) calls.push(r.url());
  });
  await page.goto(
    `http://127.0.0.1:${staticServer.address().port}/docs/panel.html#onizleme`,
  );
  await page.getByRole("button", { name: "Veri paneli", exact: true }).click();
  await page.getByRole("button", { name: "Siparişler", exact: true }).click();
  await page
    .getByRole("button", { name: "E-posta tasarımları", exact: true })
    .click();
  await page
    .getByLabel("Başlık", { exact: true })
    .fill("Siparişiniz hazır, teşekkürler.");
  await page
    .getByLabel("Satış e-posta adresi", { exact: true })
    .fill("sales-fixture@example.test");
  await expect(
    page
      .frameLocator('iframe[title="E-posta tasarım önizlemesi"]')
      .getByRole("heading", { name: "Siparişiniz hazır, teşekkürler." }),
  ).toBeVisible();
  await expect(
    page
      .frameLocator('iframe[title="E-posta tasarım önizlemesi"]')
      .getByText("Brüt toplam (KDV dahil)", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Tasarımları kaydet", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("kaydedildi");
  await page
    .getByRole("button", { name: "Mobil e-posta", exact: true })
    .click();
  await page.screenshot({
    path: "/tmp/kuzmin-email-designer.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "← Siparişlere dön", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Örnek sipariş ekle", exact: true })
    .click();
  await page.locator(".order-open").first().click();
  await page
    .getByRole("button", { name: "Örnek fatura ile dene", exact: true })
    .click();
  await expect(page.locator(".invoice-record")).toContainText(
    "ORNEK-FATURA-GECERSIZ.pdf",
  );
  await page
    .getByRole("button", { name: "E-posta tasarımları", exact: true })
    .click();
  await expect(
    page.getByLabel("Satış e-posta adresi", { exact: true }),
  ).toHaveValue("sales-fixture@example.test");
  await page
    .getByLabel("E-posta türü", { exact: true })
    .selectOption("invoice_ready");
  await page
    .locator('iframe[title="E-posta tasarım önizlemesi"]')
    .scrollIntoViewIfNeeded();
  await expect(
    page.locator('iframe[title="E-posta tasarım önizlemesi"]'),
  ).toBeVisible();
  await expect(
    page
      .frameLocator('iframe[title="E-posta tasarım önizlemesi"]')
      .locator("body"),
  ).toContainText("ORNEK-FATURA-GECERSIZ.pdf");
  await page.screenshot({
    path: "/tmp/kuzmin-invoice-email-preview.png",
    fullPage: true,
  });
  assert.deepEqual(calls, []);
  await preview.close();
  console.log(
    "PASS preview: editable desktop/mobile templates, sender placeholder, mandatory item prices/totals, persistent design draft and synthetic-only invoice flow.",
  );
  app = await testAppServer();
  const origin = app.origin,
    admin = await browser.newContext(),
    guest = await browser.newContext();
  await admin.request.post(origin + "/api/auth", {
    data: { email: "demo@local.test", password: app.password },
  });
  for (const endpoint of [
    "/api/admin/email-design",
    "/api/admin/invoices?order=x",
  ])
    assert.equal((await guest.request.get(origin + endpoint)).status(), 403);
  const input = {
    customer_name: "TEST Invoice Buyer",
    email: "invoice-buyer@example.test",
    phone: "05000000000",
    address: "Private fixture address 10",
    note: "",
    consent: true,
    locale: "tr",
    lines: [{ productId: "p1", variantId: "p1-gloss", quantity: 1 }],
  };
  const created = await (
    await guest.request.post(origin + "/api/orders", { data: input })
  ).json();
  await admin.request.get(origin + "/api/admin/orders");
  const db = new DatabaseSync(join(app.directory, ".data/store.sqlite"));
  const order = db
    .prepare("SELECT id FROM orders WHERE reference=?")
    .get(created.reference);
  assert(order);
  const pdf = Buffer.from(
    "%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n",
  );
  const upload = async (expected, bytes = pdf, name = "fixture-invoice.pdf") =>
    admin.request.post(origin + "/api/admin/invoices", {
      multipart: {
        order: order.id,
        expected: String(expected),
        file: { name, mimeType: "application/pdf", buffer: bytes },
      },
    });
  assert.equal((await upload(0)).status(), 400);
  db.prepare(
    "UPDATE orders SET demo=0,payment_status='paid',status='confirmed' WHERE id=?",
  ).run(order.id);
  let response = await upload(0);
  assert.equal(response.status(), 201, await response.text());
  const first = (await response.json()).invoice;
  assert.equal(first.version, 1);
  response = await upload(0);
  assert.equal(response.status(), 201);
  assert.equal((await response.json()).invoice.id, first.id);
  const secondPDF = Buffer.from(pdf.toString().replace("<<>>", "<< >>"));
  assert.equal((await upload(0, secondPDF)).status(), 409);
  response = await upload(1, secondPDF);
  assert.equal(response.status(), 201, await response.text());
  const second = (await response.json()).invoice;
  assert.equal(second.version, 2);
  const invoices = await (
    await admin.request.get(origin + "/api/admin/invoices?order=" + order.id)
  ).json();
  assert.equal(invoices.invoices.length, 2);
  assert(!JSON.stringify(invoices).includes("storage_key"));
  const download = await admin.request.get(
    origin + `/api/admin/invoices?order=${order.id}&file=${first.id}`,
  );
  assert.equal(download.status(), 200);
  assert.deepEqual(await download.body(), pdf);
  assert(download.headers()["content-disposition"].startsWith("attachment;"));
  assert.equal(download.headers()["x-content-type-options"], "nosniff");
  assert.equal(
    (
      await guest.request.get(
        origin + `/api/admin/invoices?order=${order.id}&file=${first.id}`,
      )
    ).status(),
    403,
  );
  assert.equal(
    (
      await admin.request.get(
        origin + `/api/admin/invoices?order=wrong-order&file=${first.id}`,
      )
    ).status(),
    404,
  );
  assert.equal((await upload(2, Buffer.from("NOT A PDF"))).status(), 400);
  assert.equal((await upload(2, pdf, "not-a-pdf.png")).status(), 400);
  assert.equal(readdirSync(join(app.directory, ".data/invoices")).length, 2);
  const notices = await (
    await admin.request.get(
      origin + "/api/admin/notifications?order=" + order.id,
    )
  ).json();
  assert.equal(notices.ready, false);
  assert.equal(
    notices.notices.filter((n) => n.kind === "invoice_ready").length,
    2,
  );
  assert(notices.notices.every((n) => n.status === "pending"));
  const settings = await (
    await admin.request.get(origin + "/api/admin/email-design")
  ).json();
  settings.settings.senderEmail = "sales-fixture@example.test";
  settings.settings.templates.order_confirmed.heading = "Fixture saved";
  response = await admin.request.post(origin + "/api/admin/email-design", {
    data: { expected: settings.revision, settings: settings.settings },
  });
  assert.equal(response.status(), 200, await response.text());
  assert.equal(
    (
      await admin.request.post(origin + "/api/admin/email-design", {
        data: { expected: settings.revision, settings: settings.settings },
      })
    ).status(),
    409,
  );
  assert.equal(
    (
      await admin.request.post(origin + "/api/admin/email-design", {
        headers: { origin: "https://foreign.example.test" },
        data: { expected: settings.revision + 1, settings: settings.settings },
      })
    ).status(),
    403,
  );
  const adminPage = await admin.newPage();
  await adminPage.goto(origin + "/admin");
  await adminPage
    .getByRole("button", { name: "Siparişler", exact: true })
    .click();
  await adminPage
    .getByRole("button", { name: created.reference, exact: true })
    .click();
  await expect(adminPage.locator(".invoice-record")).toHaveCount(2);
  await expect(adminPage.locator(".order-notices")).toContainText(
    "Fatura e-postası",
  );
  assert.equal(
    db
      .prepare(
        "SELECT count(*) n FROM order_notifications WHERE kind='invoice_ready' AND status='sent'",
      )
      .get().n,
    0,
  );
  db.close();
  await admin.close();
  await guest.close();
  console.log(
    "PASS app: paid-only bounded PDF uploads, dedupe/CAS, private download/ownership, preserved history, atomic automatic invoice notices, no fake sends, protected saved template settings.",
  );
} catch (error) {
  for (const context of browser.contexts())
    for (const page of context.pages()) {
      try {
        await page.screenshot({
          path: "/tmp/kuzmin-email-invoice-failure.png",
          fullPage: true,
        });
        console.log(
          await page
            .locator('iframe[title="E-posta tasarım önizlemesi"]')
            .evaluateAll((nodes) =>
              nodes.map((n) => ({
                rect: n.getBoundingClientRect().toJSON(),
                display: getComputedStyle(n).display,
                visibility: getComputedStyle(n).visibility,
              })),
            ),
        );
      } catch {}
    }
  throw error;
} finally {
  await browser.close();
  if (app) await app.stop();
  staticServer.closeAllConnections();
  await new Promise((r) => staticServer.close(r));
}
