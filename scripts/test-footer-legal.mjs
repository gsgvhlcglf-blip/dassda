import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { testAppServer } from "./test-app-server.mjs";
import { dismissCookies } from "./test-cookie-helper.mjs";
const app = process.argv.includes("--app"),
  key = "kuzmin.workspace.gsgvhlcglf-blip.dassda.v1";
const pages = JSON.parse(readFileSync("src/content/legal-pages.json", "utf8"));
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
      viewport: { width: 1440, height: 1000 },
    }),
    page = await context.newPage(),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  if (!app) {
    const source = readFileSync("docs/panel.html", "utf8"),
      catalog = JSON.parse(source.match(/const INITIAL = (\{[^\n]*\});/)[1]);
    catalog.content = catalog.content.filter(
      (r) => !["distance-sales", "pre-information"].includes(r.key),
    );
    catalog.content.find((r) => r.key === "privacy").body.tr =
      "Legacy privacy placeholder";
    catalog.products[0].price = 9876;
    await page.addInitScript(
      ({ catalog, key }) => {
        if (!localStorage.getItem(key))
          localStorage.setItem(key, JSON.stringify(catalog));
      },
      { catalog, key },
    );
  }
  await page.goto(origin + (app ? "/" : "/docs/panel.html"));
  const view = () => (app ? page : page.frameLocator("#site-frame"));
  await dismissCookies(view());
  if (!app) await page.locator("#site-inspect").uncheck();
  const expected = [
    "Sık sorulan sorular",
    "Kargo takip",
    "Gizlilik ve Çerez Politikası",
    "Mesafeli Satış Sözleşmesi",
    "Ön Bilgilendirme Formu",
    "İptal ve İade Koşulları",
    "Kullanıcı Sözleşmesi / Şartlar ve Koşullar",
  ];
  assert.deepEqual(
    await view().locator(".footer-nav a").allTextContents(),
    expected,
  );
  assert.equal(
    await view()
      .locator(".footer-title,footer .eyebrow,footer a[href='/admin']")
      .count(),
    0,
  );
  await expect(view().locator(".footer-top .wordmark")).toBeVisible();
  for (const legal of pages) {
    await view().locator(`.footer-nav a[href="${legal.path}"]`).click();
    await expect(view().locator("main h1")).toHaveText(legal.title.tr);
    await expect(view().locator(".legal-page .content-body")).toContainText(
      "(Buraya",
    );
    assert((await view().locator(".content-body h2").count()) >= 8);
    await expect(view().locator(".legal-template-note")).toContainText(
      "siparişe özel belge",
    );
  }
  await page.screenshot({
    path: "/tmp/legal-desktop-" + (app ? "app" : "preview") + ".png",
    fullPage: true,
  });
  if (app) await page.setViewportSize({ width: 390, height: 844 });
  else await page.getByRole("button", { name: "Mobil", exact: true }).click();
  assert(
    await view()
      .locator("html")
      .evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  );
  await expect(view().locator(".footer-top .wordmark")).toBeVisible();
  await page.screenshot({
    path: "/tmp/legal-mobile-" + (app ? "app" : "preview") + ".png",
    fullPage: true,
  });
  if (app) {
    const admin = await browser.newContext(),
      panel = await admin.newPage();
    await panel.goto(origin + "/admin");
    await panel.getByLabel("Şifre", { exact: true }).fill(server.password);
    await panel.getByRole("button", { name: "Giriş yap", exact: true }).click();
    await panel
      .getByRole("heading", { name: "Genel bakış", exact: true })
      .waitFor();
    let data = await (await admin.request.get(origin + "/api/admin")).json();
    const record = data.content.find((r) => r.key === "pre-information");
    assert(record);
    record.body.tr = "Firma sahibinin sonraki hukuk metni.";
    const saved = await admin.request.post(origin + "/api/admin", {
      data: {
        table: "content",
        action: "update",
        record,
        expectedRevision: data._workspace[0].revision,
      },
    });
    assert(saved.ok(), await saved.text());
    data = await (await admin.request.get(origin + "/api/admin")).json();
    const published = await admin.request.post(origin + "/api/admin/studio", {
      data: {
        action: "publish",
        expectedRevision: data._workspace[0].revision,
      },
    });
    assert(published.ok(), await published.text());
    await page.goto(origin + "/on-bilgilendirme-formu");
    await expect(page.locator(".content-body")).toHaveText(
      "Firma sahibinin sonraki hukuk metni.",
    );
    await page.reload();
    await expect(page.locator(".content-body")).toHaveText(
      "Firma sahibinin sonraki hukuk metni.",
    );
    await admin.close();
  } else {
    await page.getByRole("button", { name: "Masaüstü", exact: true }).click();
    await page.locator("#site-page").selectOption("preInformation");
    await page.locator("#site-inspect").check();
    await view().locator(".content-body p").first().click();
    await page.waitForFunction(
      () =>
        document
          .querySelector(".site-direct-editor")
          ?.getAttribute("data-edit-key") === "content:pre-information:body",
    );
    await page
      .getByLabel("Seçili metni düzenle")
      .fill("Firma sahibinin sonraki hukuk metni.");
    await expect(view().locator(".content-body")).toHaveText(
      "Firma sahibinin sonraki hukuk metni.",
    );
    await page.reload();
    await expect(view().locator(".content-body")).toHaveText(
      "Firma sahibinin sonraki hukuk metni.",
    );
    const stored = await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)),
      key,
    );
    assert.equal(stored.products[0].price, 9876);
    assert.equal(
      stored.content.filter((r) => r.key === "pre-information").length,
      1,
    );
  }
  assert.deepEqual(errors, []);
  console.log(
    `PASS (${app ? "app" : "preview"}): footer removals, seven links, five complete editable templates, old drafts, mobile logo/layout, owner edits and publication.`,
  );
} finally {
  await browser.close();
  if (app) await server.stop();
  else {
    server.closeAllConnections();
    await new Promise((r) => server.close(r));
  }
}
