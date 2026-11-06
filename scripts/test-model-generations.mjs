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
    const p = new URL(req.url, "http://localhost").pathname;
    if (!/^\/docs\/(panel\.html|store\.html|panel-version\.json)$/.test(p))
      return res.writeHead(404).end();
    res.setHeader(
      "Content-Type",
      p.endsWith("json") ? "application/json" : "text/html; charset=utf-8",
    );
    res.end(readFileSync("." + p));
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
  });
  context.setDefaultTimeout(15000);
  const page = await context.newPage(),
    shop = await context.newPage(),
    errors = [];
  let initialCatalog;
  for (const p of [page, shop])
    p.on("pageerror", (e) => errors.push(e.message));
  await page.goto(origin + (app ? "/admin" : "/docs/panel.html"));
  if (app) {
    await page.getByLabel("Şifre", { exact: true }).fill(server.password);
    await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
    await page
      .getByRole("heading", { name: "Genel bakış", exact: true })
      .waitFor();
  } else {
    await page.frameLocator("#site-frame").locator(".hero").waitFor();
    initialCatalog = await page
      .locator("#site-frame")
      .evaluate((iframe) => iframe.contentWindow.__KZ_SITE__.catalog);
    await page
      .getByRole("button", { name: "Veri paneli", exact: true })
      .click();
  }
  const section = async (name) =>
    page.getByRole("button", { name, exact: true }).click();
  const catalog = async () =>
    app
      ? (await (await context.request.get(origin + "/api/admin/studio")).json())
          .snapshot.catalog
      : (await page.evaluate(
          (k) => JSON.parse(localStorage.getItem(k)),
          key,
        )) || initialCatalog;
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
  const save = async () =>
    page
      .getByRole("button", {
        name: app ? "Kaydet" : "Değişiklikleri kaydet ✓",
        exact: true,
      })
      .click();
  const models = async () =>
    section(app ? "Motosiklet modelleri" : "Motosikletler");
  const edit = async () => {
    await models();
    await page
      .locator("tbody tr")
      .filter({ hasText: "MT-25" })
      .getByRole("button", { name: /Düzenle/ })
      .click();
  };
  async function row(i, from, to, name) {
    await page
      .getByLabel("Başlangıç yılı " + i, { exact: true })
      .fill(String(from));
    await page.getByLabel("Bitiş yılı " + i, { exact: true }).fill(String(to));
    await page.getByLabel("Nesil açıklaması " + i, { exact: true }).fill(name);
  }
  const add = async () =>
    page
      .getByRole("button", { name: "+ Yıl aralığı ekle", exact: true })
      .click();
  const visit = async (path) => {
    await shop.goto(origin + (app ? path : "/docs/store.html#" + path));
    if (!app) await shop.reload();
  };
  const before = await catalog(),
    expected = {};
  await publish();
  for (let y = 2022; y <= 2026; y++) {
    await visit("/motosikletler/yamaha/mt-25/" + y);
    await expect(shop.locator(".selection-strip")).toContainText(String(y));
    expected[y] = await shop.locator(".product-card h2").allTextContents();
  }
  await edit();
  await row(1, 2022, 2023, "1. nesil · ilk kasa");
  await add();
  await row(2, 2024, 2025, "2. nesil · güncellenen kasa");
  await add();
  await row(3, 2026, 2026, "3. nesil · son kasa");
  await save();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  const after = await catalog();
  assert.equal(
    after.generations.filter((g) => g.model_id === "yamaha-mt-25").length,
    3,
  );
  for (const y of before.model_years.filter(
    (y) => y.model_id === "yamaha-mt-25",
  ))
    assert.equal(
      after.model_years.find(
        (v) => v.model_id === y.model_id && v.year === y.year,
      ).id,
      y.id,
    );
  for (const t of [
    "models",
    "products",
    "product_images",
    "variants",
    "content",
  ])
    assert.deepEqual(after[t], before[t]);
  await edit();
  await page.getByLabel("Başlangıç yılı 2", { exact: true }).fill("2023");
  await save();
  await page
    .getByRole("alert")
    .filter({ hasText: /Yıl aralıkları çakışıyor/ })
    .waitFor();
  assert.deepEqual(await catalog(), after);
  await page.getByLabel("Başlangıç yılı 2", { exact: true }).fill("2024");
  await page
    .getByRole("button", { name: "2. yıl aralığını kaldır", exact: true })
    .click();
  await save();
  await page
    .getByRole("alert")
    .filter({ hasText: /Mevcut parça uyumluluğu/ })
    .waitFor();
  assert.deepEqual(await catalog(), after);
  await page.getByRole("button", { name: "Kapat", exact: true }).click();
  await publish();
  await visit("/motosikletler/yamaha/mt-25");
  await expect(shop.locator(".years")).toContainText(
    "2. nesil · güncellenen kasa",
  );
  for (let y = 2022; y <= 2026; y++) {
    await visit("/motosikletler/yamaha/mt-25/" + y);
    await expect(shop.locator(".selection-strip")).toContainText(String(y));
    assert.deepEqual(
      await shop.locator(".product-card h2").allTextContents(),
      expected[y],
    );
  }
  await page.reload();
  if (!app)
    await page
      .getByRole("button", { name: "Veri paneli", exact: true })
      .click();
  await edit();
  assert.equal(await page.locator(".generation-editor-row").count(), 3);
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByLabel("Nesil açıklaması 3", { exact: true })
    .scrollIntoViewIfNeeded();
  await page.screenshot({
    path: app
      ? "/tmp/kuzmin-generations-app.png"
      : "/tmp/kuzmin-generations-panel.png",
  });
  assert(
    await page.locator(".generation-editor").evaluate((editor) => {
      const fields = [editor, ...editor.querySelectorAll("input")];
      return fields.every((el) => {
        const r = el.getBoundingClientRect();
        return r.left >= 0 && r.right <= innerWidth + 1;
      });
    }),
    "Generation editor and every input must fit the mobile viewport",
  );
  await page.getByRole("button", { name: "Kapat", exact: true }).click();
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page
    .getByRole("button", {
      name: app ? "Yeni kayıt" : "+ Yeni kayıt",
      exact: true,
    })
    .click();
  if (app) {
    await page.getByLabel("Marka", { exact: true }).selectOption("yamaha");
    await page
      .getByLabel("URL adı (küçük harf, tire)", { exact: true })
      .fill("r25-three-generations-test");
    await page.getByLabel("Yayında", { exact: true }).check();
  }
  await page
    .getByLabel("Model adı", { exact: true })
    .fill("R25 · üç nesil test kaydı");
  for (const [i, from, to] of [
    [1, 2015, 2018],
    [2, 2019, 2022],
    [3, 2023, 2026],
  ]) {
    await add();
    await row(i, from, to, i + ". nesil · test verisi");
  }
  await save();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  const fresh = await catalog(),
    newModel = fresh.models.find((m) => m.name === "R25 · üç nesil test kaydı");
  assert.equal(
    fresh.generations.filter((g) => g.model_id === newModel.id).length,
    3,
  );
  assert.equal(
    fresh.model_years.filter((y) => y.model_id === newModel.id).length,
    12,
  );
  assert(!fresh.compatibility.some((f) => f.model_id === newModel.id));
  assert.deepEqual(errors, []);
  console.log(
    `PASS (${app ? "production app" : "browser panel"}): three-generation create/edit, range validation, exact fitment preservation, publication, reload and mobile forms.`,
  );
} finally {
  await browser.close();
  if (app) await server.stop();
  else {
    server.closeAllConnections();
    await new Promise((r) => server.close(r));
  }
}
