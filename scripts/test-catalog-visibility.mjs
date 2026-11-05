import { chromium } from "@playwright/test";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { testAppServer } from "./test-app-server.mjs";

const app = process.argv.includes("--app");
const KEY = "kuzmin.workspace.gsgvhlcglf-blip.dassda.v1";
let server, origin;
if (app) {
  server = await testAppServer();
  origin = server.origin;
} else {
  server = createServer((req, res) => {
    const path = new URL(req.url, "http://localhost").pathname;
    if (!/^\/docs\/(panel\.html|store\.html|panel-version\.json)$/.test(path)) {
      res.writeHead(404).end();
      return;
    }
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
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage(),
    shop = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  shop.on("pageerror", (e) => errors.push(e.message));
  page.on("dialog", (d) => d.accept());
  await page.goto(origin + (app ? "/admin" : "/docs/panel.html"));
  if (app) {
    await page.getByLabel("Şifre", { exact: true }).fill(server.password);
    await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
    await page
      .getByRole("heading", { name: "Genel bakış", exact: true })
      .waitFor();
  } else {
    // A legacy owner draft with multiple generations must keep all its records.
    await page.frameLocator("#site-frame").locator(".hero").waitFor();
    await page.evaluate((key) => {
      const c = JSON.parse(localStorage.getItem(key)) || document.querySelector("#site-frame").contentWindow.__KZ_SITE__.catalog;
      for (const m of c.models) delete m.published;
      c.generations.push({
        ...c.generations.find((g) => g.model_id === "yamaha-mt-25"),
        id: "preserved-second-generation",
      });
      localStorage.setItem(key, JSON.stringify(c));
    }, KEY);
    await page.reload();
    await page
      .getByRole("button", { name: "Veri paneli", exact: true })
      .click();
  }
  const catalog = async () =>
    app
      ? (await (await context.request.get(origin + "/api/admin/studio")).json())
          .snapshot.catalog
      : page.evaluate((key) => JSON.parse(localStorage.getItem(key)), KEY);
  const before = await catalog();
  async function section(name) {
    await page.getByRole("button", { name, exact: true }).click();
  }
  async function publish() {
    await section("Yayın & sürümler");
    const button = page.getByRole("button", { name: "Taslağı yayınla", exact: true });
    if (app) {
      await Promise.all([
        page.waitForResponse((r) => r.url().endsWith("/api/admin/studio") && r.request().method() === "POST" && r.ok()),
        button.click(),
      ]);
    } else {
      const key = KEY + ".published";
      const previous = await page.evaluate((k) => localStorage.getItem(k), key);
      await button.click();
      await page.waitForFunction(({key, previous}) => localStorage.getItem(key) !== previous, {key, previous});
    }
    await page.getByText("Şu an yayında", { exact: false }).first().waitFor();
  }
  async function toggle(table, title, enabled) {
    await section(
      table === "models"
        ? app
          ? "Motosiklet modelleri"
          : "Motosikletler"
        : "Ürünler",
    );
    const row = page.locator("tbody tr").filter({ hasText: title });
    await row.getByRole("button", { name: /Düzenle/ }).click();
    await page.getByLabel("Yayında", { exact: true }).setChecked(enabled);
    await page
      .getByRole("button", {
        name: app ? "Kaydet" : "Değişiklikleri kaydet ✓",
        exact: true,
      })
      .click();
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    if (!enabled)
      await row.getByText("Yayında değil", { exact: false }).waitFor();
  }
  const visit = async (path) => {
    const response = await shop.goto(
      origin + (app ? path : "/docs/store.html#" + path),
    );
    if (app) return response;
    await shop.reload();
    await shop.locator(".site-header").waitFor();
  };
  await publish();
  await toggle("models", "MT-25", false);
  await toggle("products", "Karbon ön çamurluk", false);
  const draft = await catalog();
  for (const table of [
    "generations",
    "model_years",
    "compatibility",
    "product_images",
    "variants",
  ])
    assert.deepEqual(
      draft[table],
      before[table],
      table + " must remain intact",
    );
  await visit("/motosikletler/yamaha/mt-25");
  await shop.locator(".years").waitFor(); // Saved changes are still private drafts.
  await publish();
  await visit("/motosikletler/yamaha");
  assert.equal(
    await shop.locator(".model-card").filter({ hasText: "MT-25" }).count(),
    0,
  );
  for (const path of [
    "/motosikletler/yamaha/mt-25",
    "/motosikletler/yamaha/mt-25/2024",
    "/urunler/karbon-on-camurluk",
  ]) {
    const response = await visit(path);
    if (app) {
      // Next.js can send 200 before a streamed notFound() finishes rendering.
      assert([200, 404].includes(response.status()), path);
      await shop.getByRole("heading", { name: "Bu yol henüz yok." }).waitFor();
      assert(await shop.locator('meta[name="robots"][content*="noindex"]').count());
    } else
      await shop
        .getByRole("heading", { name: "Bu sayfa şu anda yayında değil." })
        .waitFor();
    assert.equal(
      await shop.locator(".years,.product-copy,.selection-strip").count(),
      0,
    );
  }
  await visit("/motosikletler/yamaha/mt-09/2024");
  await shop
    .locator(".product-card")
    .filter({ hasText: "Karbon depo kaplaması" })
    .waitFor();
  await visit("/urunler");
  assert.equal(
    await shop
      .locator(".product-card")
      .filter({ hasText: "Karbon ön çamurluk" })
      .count(),
    0,
  );
  await toggle("models", "MT-25", true);
  await toggle("products", "Karbon ön çamurluk", true);
  await publish();
  await visit("/motosikletler/yamaha/mt-25/2024");
  await shop
    .locator(".product-card")
    .filter({ hasText: "Karbon ön çamurluk" })
    .waitFor();
  await visit("/urunler/karbon-on-camurluk");
  await shop.locator(".product-copy h1").waitFor();
  assert.deepEqual(errors, []);
  console.log(
    `PASS (${app ? "production app" : "browser panel"}): hide/publish/restore, direct URLs, preserved years/photos/compatibility, legacy drafts and shared products.`,
  );
} finally {
  await browser.close();
  if (app) await server.stop();
  else await new Promise((r) => server.close(r));
}
