import { chromium, expect } from "@playwright/test";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { testAppServer } from "./test-app-server.mjs";

const app = process.argv.includes("--app"),
  key = "kuzmin.workspace.gsgvhlcglf-blip.dassda.v1";
let server, origin;
if (app) {
  server = await testAppServer();
  origin = server.origin;
} else {
  server = createServer((req, res) => {
    const path = new URL(req.url, "http://localhost").pathname;
    if (!/^\/docs\/(panel\.html|store\.html|panel-version\.json)$/.test(path))
      return res.writeHead(404).end();
    res.setHeader(
      "Content-Type",
      path.endsWith("json") ? "application/json" : "text/html; charset=utf-8",
    );
    res.end(readFileSync("." + path));
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  origin = "http://127.0.0.1:" + server.address().port;
}
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
try {
  const context = await browser.newContext({
      viewport: { width: 1440, height: 1100 },
    }),
    page = await context.newPage(),
    shop = await context.newPage(),
    errors = [];
  context.setDefaultTimeout(15000);
  for (const p of [page, shop])
    p.on("pageerror", (e) => errors.push(e.message));
  await page.goto(origin + (app ? "/admin" : "/docs/panel.html"));
  let initial;
  if (app) {
    await page.getByLabel("Şifre", { exact: true }).fill(server.password);
    await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
    await page
      .getByRole("heading", { name: "Genel bakış", exact: true })
      .waitFor();
  } else {
    await page.frameLocator("#site-frame").locator(".hero").waitFor();
    initial = await page
      .locator("#site-frame")
      .evaluate((f) => f.contentWindow.__KZ_SITE__.catalog);
    await page
      .getByRole("button", { name: "Veri paneli", exact: true })
      .click();
  }
  const catalog = async () =>
    app
      ? (await (await context.request.get(origin + "/api/admin/studio")).json())
          .snapshot.catalog
      : (await page.evaluate(
          (k) => JSON.parse(localStorage.getItem(k)),
          key,
        )) || initial;
  const section = async (name) =>
    page.getByRole("button", { name, exact: true }).click();
  const save = async () =>
    page
      .getByRole("button", {
        name: app ? "Kaydet" : "Değişiklikleri kaydet ✓",
        exact: true,
      })
      .click();
  const add = async () =>
    page
      .getByRole("button", { name: "+ Uyumlu model ekle", exact: true })
      .click();
  async function fit(i, brand, model, from, to) {
    await add();
    await page
      .getByLabel("Uyumlu marka " + i, { exact: true })
      .selectOption(brand);
    await page
      .getByLabel("Uyumlu model " + i, { exact: true })
      .selectOption(model);
    if (i === 1) {
      await page
        .getByLabel("Uyumlu nesil 1", { exact: true })
        .selectOption(model + "-demo");
      await expect(
        page.getByLabel("Uyumlu başlangıç yılı 1", { exact: true }),
      ).toHaveValue("2022");
    }
    await page
      .getByLabel("Uyumlu başlangıç yılı " + i, { exact: true })
      .selectOption(String(from));
    await page
      .getByLabel("Uyumlu bitiş yılı " + i, { exact: true })
      .selectOption(String(to));
  }
  async function publish() {
    await section("Yayın & sürümler");
    const button = page.getByRole("button", {
      name: "Taslağı yayınla",
      exact: true,
    });
    if (app)
      await Promise.all([
        page.waitForResponse(
          (r) =>
            r.url().endsWith("/api/admin/studio") &&
            r.request().method() === "POST" &&
            r.ok(),
        ),
        button.click(),
      ]);
    else {
      const old = await page.evaluate(
        (k) => localStorage.getItem(k + ".published"),
        key,
      );
      await button.click();
      await page.waitForFunction(
        ({ key, old }) => localStorage.getItem(key + ".published") !== old,
        { key, old },
      );
    }
  }
  const visit = async (path) => {
    await shop.goto(origin + (app ? path : "/docs/store.html#" + path));
    if (!app) await shop.reload();
  };
  const before = await catalog();
  await section("Ürünler");
  await page
    .locator("tbody tr")
    .filter({ hasText: "Karbon ön çamurluk" })
    .getByRole("button", { name: /Düzenle/ })
    .click();
  await expect(
    page.locator(".product-compatibility-editor .generation-editor-row"),
  ).toHaveCount(
    before.compatibility.filter((f) => f.product_id === "p1").length,
  );
  await page.getByRole("button", { name: "Kapat", exact: true }).click();
  await page
    .getByRole("button", {
      name: app ? "Yeni kayıt" : "+ Yeni kayıt",
      exact: true,
    })
    .click();
  await page
    .getByLabel(app ? "Ürün adı / TR" : "Ürün adı", { exact: true })
    .fill("Uyumluluk test parçası");
  if (app) {
    await page
      .getByLabel("URL adı", { exact: true })
      .fill("compatibility-editor-test");
    await page.getByLabel("Kategori", { exact: true }).selectOption("body");
  }
  await page.getByLabel("SKU", { exact: true }).fill("TEST-FIT-EDITOR");
  await page
    .getByLabel("Ürün fiyatı (TRY, KDV dahil)", { exact: true })
    .fill("2500");
  await page.getByLabel("Yayında", { exact: true }).check();
  await fit(1, "yamaha", "yamaha-mt-25", 2024, 2025);
  await fit(2, "bmw", "bmw-s1000rr", 2023, 2024);
  await fit(3, "ducati", "ducati-monster", 2026, 2026);
  await save();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  const created = await catalog(),
    product = created.products.find((p) => p.sku === "TEST-FIT-EDITOR");
  assert(product);
  assert.equal(
    created.compatibility.filter((f) => f.product_id === product.id).length,
    3,
  );
  assert.deepEqual(
    created.compatibility.filter((f) => f.product_id !== product.id),
    before.compatibility,
  );
  await page
    .locator("tbody tr")
    .filter({ hasText: "TEST-FIT-EDITOR" })
    .getByRole("button", { name: /Düzenle/ })
    .click();
  await fit(4, "yamaha", "yamaha-mt-25", 2024, 2025);
  await save();
  await page
    .getByRole("alert")
    .filter({ hasText: /yıl aralıkları çakışıyor/ })
    .waitFor();
  assert.deepEqual(await catalog(), created);
  await page
    .getByRole("button", { name: "4. uyumluluğu kaldır", exact: true })
    .click();
  await page
    .getByLabel("Uyumlu bitiş yılı 1", { exact: true })
    .selectOption("2024");
  await page
    .getByRole("button", { name: "2. uyumluluğu kaldır", exact: true })
    .click();
  await save();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  const edited = await catalog();
  assert.equal(
    edited.compatibility.filter((f) => f.product_id === product.id).length,
    2,
  );
  if (app) {
    const workspace = await (
      await context.request.get(origin + "/api/admin/studio")
    ).json();
    const response = await context.request.post(origin + "/api/admin", {
      data: {
        table: "products",
        action: "update",
        record: product,
        expectedRevision: workspace.revision,
        compatibilityRows: [
          {
            ...edited.compatibility.find((f) => f.product_id === product.id),
            brand_id: "yamaha",
            id: before.compatibility[0].id,
          },
        ],
      },
    });
    assert.equal(response.status(), 400);
    assert.deepEqual(await catalog(), edited);
    const anonymous = await browser.newContext();
    assert.equal(
      (
        await anonymous.request.post(origin + "/api/admin", {
          headers: { Origin: origin },
          data: {
            table: "products",
            action: "update",
            record: product,
            compatibilityRows: [],
          },
        })
      ).status(),
      401,
    );
    await anonymous.close();
  }
  await visit("/motosikletler/yamaha/mt-25/2024");
  await expect(shop.locator(".selection-strip")).toContainText("2024");
  assert.equal(
    await shop
      .locator(".product-card")
      .filter({ hasText: "Uyumluluk test parçası" })
      .count(),
    0,
  );
  await publish();
  for (const [path, show] of [
    ["/motosikletler/yamaha/mt-25/2024", true],
    ["/motosikletler/yamaha/mt-25/2025", false],
    ["/motosikletler/bmw/s1000rr/2023", false],
    ["/motosikletler/ducati/monster/2026", true],
  ]) {
    await visit(path);
    await expect(shop.locator(".selection-strip")).toContainText(
      path.split("/").at(-1),
    );
    assert.equal(
      await shop
        .locator(".product-card")
        .filter({ hasText: "Uyumluluk test parçası" })
        .count(),
      show ? 1 : 0,
      path,
    );
  }
  await page.reload();
  if (!app)
    await page
      .getByRole("button", { name: "Veri paneli", exact: true })
      .click();
  await section("Ürünler");
  await page
    .locator("tbody tr")
    .filter({ hasText: "TEST-FIT-EDITOR" })
    .getByRole("button", { name: /Düzenle/ })
    .click();
  await expect(
    page.locator(".product-compatibility-editor .generation-editor-row"),
  ).toHaveCount(2);
  await expect(
    page.getByLabel("Uyumlu bitiş yılı 1", { exact: true }),
  ).toHaveValue("2024");
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByLabel("Uyumlu bitiş yılı 2", { exact: true })
    .scrollIntoViewIfNeeded();
  assert(
    await page.locator(".product-compatibility-editor").evaluate((editor) =>
      [editor, ...editor.querySelectorAll("select")].every((el) => {
        const r = el.getBoundingClientRect();
        return r.left >= 0 && r.right <= innerWidth + 1;
      }),
    ),
  );
  await page.screenshot({
    path: app
      ? "/tmp/kuzmin-product-fit-app.png"
      : "/tmp/kuzmin-product-fit-panel.png",
  });
  assert.deepEqual(errors, []);
  console.log(
    `PASS (${app ? "production app" : "browser panel"}): inline product create/edit, three brands, generation/year selection, removal, duplicate rejection, atomic persistence, publication, exact customer filtering and mobile forms.`,
  );
} finally {
  await browser.close();
  if (app) await server.stop();
  else {
    server.closeAllConnections();
    await new Promise((r) => server.close(r));
  }
}
