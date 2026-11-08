import { chromium, expect } from "@playwright/test";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { testAppServer } from "./test-app-server.mjs";
import { dismissCookies } from "./test-cookie-helper.mjs";

const app = process.argv.includes("--app");
const key = "kuzmin.workspace.gsgvhlcglf-blip.dassda.v1";
const year = Number(new Intl.DateTimeFormat("en", { year: "numeric", timeZone: "Europe/Istanbul" }).format(new Date()));
let server, origin;
if (app) {
  server = await testAppServer(); origin = server.origin;
} else {
  server = createServer((req, res) => {
    const path = new URL(req.url, "http://localhost").pathname;
    if (!/^\/docs\/(panel\.html|store\.html|panel-version\.json)$/.test(path)) return res.writeHead(404).end();
    res.setHeader("Content-Type", path.endsWith("json") ? "application/json" : "text/html; charset=utf-8");
    res.end(readFileSync("." + path));
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  origin = "http://127.0.0.1:" + server.address().port;
}
const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", args: ["--no-sandbox"] });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage(), errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(origin + (app ? "/admin" : "/docs/panel.html"));
  if (app) {
    await page.getByLabel("Şifre", { exact: true }).fill(server.password);
    await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
    await page.getByRole("heading", { name: "Genel bakış", exact: true }).waitFor();
  } else {
    await page.frameLocator("#site-frame").locator(".hero").waitFor();
    await dismissCookies(page.frameLocator("#site-frame"));
    await page.getByRole("button", { name: "Veri paneli", exact: true }).click();
  }
  const models = () => page.getByRole("button", { name: app ? "Motosiklet modelleri" : "Motosikletler", exact: true }).click();
  const save = async () => {
    await page.getByRole("button", { name: app ? "Kaydet" : "Değişiklikleri kaydet ✓", exact: true }).click();
    await page.getByRole("dialog").waitFor({ state: "hidden" });
  };
  const catalog = async () => app
    ? (await (await context.request.get(origin + "/api/admin/studio")).json()).snapshot.catalog
    : await page.evaluate(key => JSON.parse(localStorage.getItem(key)), key);
  await models();
  await page.getByRole("button", { name: app ? "Yeni kayıt" : "+ Yeni kayıt", exact: true }).click();
  await page.getByLabel("Marka", { exact: true }).selectOption("yamaha");
  await page.getByLabel("Model adı", { exact: true }).fill("Günümüz test modeli");
  if (app) await page.getByLabel("URL adı (küçük harf, tire)", { exact: true }).fill("ongoing-test-model");
  await page.getByLabel("Yayında", { exact: true }).check();
  await page.getByRole("button", { name: "+ Yıl aralığı ekle", exact: true }).click();
  await page.getByLabel("Başlangıç yılı 1", { exact: true }).fill(String(year - 1));
  await page.getByLabel("Nesil açıklaması 1", { exact: true }).fill("Devam eden kasa");
  await page.getByLabel("Günümüz 1", { exact: true }).check();
  await expect(page.getByLabel("Bitiş yılı 1", { exact: true })).toBeDisabled();
  await expect(page.getByLabel("Bitiş yılı 1", { exact: true })).toHaveValue(String(year));
  await expect(page.locator(".generation-editor-row legend")).toContainText(`${year-1}–Günümüz`);
  await page.locator(".generation-editor").screenshot({ path: `/tmp/ongoing-generation-${app ? "app" : "preview"}.png` });
  await save();
  const data = await catalog(), model = data.models.find(model => model.name === "Günümüz test modeli");
  const group = data.generations.find(group => group.model_id === model.id);
  assert.equal(group.ongoing, true); assert.equal(group.end_year, year);
  assert.deepEqual(data.model_years.filter(row => row.model_id === model.id).map(row => row.year).sort(), [year-1, year]);
  assert.equal(data.compatibility.some(row => row.model_id === model.id), false);
  await page.reload();
  if (!app) {
    await page.frameLocator("#site-frame").locator(".hero").waitFor();
    await page.getByRole("button", { name: "Veri paneli", exact: true }).click();
  }
  await models();
  const row = page.locator("tbody tr").filter({ hasText: "Günümüz test modeli" });
  if (!app) await expect(row).toContainText(`${year-1}–Günümüz`);
  await row.getByRole("button", { name: /Düzenle/ }).click();
  await expect(page.getByLabel("Günümüz 1", { exact: true })).toBeChecked();
  await page.getByLabel("Günümüz 1", { exact: true }).uncheck();
  await expect(page.getByLabel("Bitiş yılı 1", { exact: true })).toBeEnabled();
  await page.getByLabel("Günümüz 1", { exact: true }).check();
  await save();
  await page.getByRole("button", { name: "Yayın & sürümler", exact: true }).click();
  await page.getByRole("button", { name: "Taslağı yayınla", exact: true }).click();
  const shop = await context.newPage();
  const path = "/motosikletler/yamaha/" + model.slug;
  await shop.goto(origin + (app ? path : "/docs/store.html#" + path));
  await shop.locator(".years").waitFor(); await dismissCookies(shop);
  assert.deepEqual((await shop.locator(".years a").allTextContents()).map(text => Number.parseInt(text, 10)), [year, year-1]);
  assert.deepEqual(errors, []);
  console.log(`PASS (${app ? "app" : "preview"}): ongoing checkbox disables end year, persists through reload, fixed-year toggle works, publication exposes only years through today and invents no product fitment`);
} finally {
  await browser.close();
  if (app) await server.stop();
  else { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
}
