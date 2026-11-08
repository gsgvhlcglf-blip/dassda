import { dismissCookies } from "./test-cookie-helper.mjs";
import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { testAppServer } from "./test-app-server.mjs";
const app = process.argv.includes("--app"),
  key = "kuzmin.workspace.gsgvhlcglf-blip.dassda.v1";
let server, origin, db;
if (app) {
  server = await testAppServer();
  origin = server.origin;
  db = new DatabaseSync(join(server.directory, ".data/store.sqlite"));
  db.exec("UPDATE analytics_settings SET enabled=1 WHERE id='site'");
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
  const view = () => (app ? page : page.frameLocator("#site-frame"));
  const fitment = async (dismiss = true) => {
    if (app) await page.goto(origin + "/motosikletler/yamaha/mt-25/2024");
    else {
      await page.locator("#site-page").selectOption("fitment");
      await page.locator("#site-inspect").uncheck();
    }
    await view().locator(".request-options").waitFor();
    if (dismiss) await dismissCookies(view());
  };
  await page.goto(
    origin + (app ? "/motosikletler/yamaha/mt-25/2024" : "/docs/panel.html"),
  );
  if (!app) await fitment(false);
  await expect(
    view().getByRole("region", { name: "Çerez bildirimi" }),
  ).toBeVisible();
  assert.equal(
    await view()
      .locator("html")
      .evaluate(() => sessionStorage.getItem("kz.analytics.tab")),
    null,
  );
  await view()
    .getByRole("button", { name: "Tercihleri yönet", exact: true })
    .click();
  await expect(
    view().getByRole("checkbox", { name: "Gerekli depolama", exact: true }),
  ).toBeChecked();
  await expect(
    view().getByRole("checkbox", { name: "Gerekli depolama", exact: true }),
  ).toBeDisabled();
  await expect(
    view().getByRole("checkbox", {
      name: "İstatistik ve ısı haritası",
      exact: true,
    }),
  ).not.toBeChecked();
  if (app) await page.waitForTimeout(5200);
  if (app)
    assert.equal(
      db.prepare("select count(*) as n from analytics_events").get().n,
      0,
    );
  await page.screenshot({
    path: "/tmp/fitment-cookie-desktop.png",
    fullPage: true,
  });
  if (app) await page.setViewportSize({ width: 390, height: 844 });
  else await page.getByRole("button", { name: "Mobil", exact: true }).click();
  assert(
    await view()
      .locator("html")
      .evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  );
  await page.screenshot({
    path: "/tmp/fitment-cookie-mobile.png",
    fullPage: true,
  });
  await view().getByRole("button", { name: "Reddet", exact: true }).click();
  await expect(view().locator(".cookie-notice")).toHaveCount(0);
  await page.reload();
  if (!app) await fitment(false);
  await expect(view().locator(".cookie-notice")).toBeVisible();
  assert.equal(
    await view()
      .locator("html")
      .evaluate(() => sessionStorage.getItem("kz.analytics.tab")),
    null,
  );
  await dismissCookies(view());
  if (app) await page.setViewportSize({ width: 1440, height: 1000 });
  else
    await page.getByRole("button", { name: "Masaüstü", exact: true }).click();
  const geometry = await view()
    .locator(".request-options")
    .evaluate((el) => ({
      top: el.getBoundingClientRect().top,
      bottom: document.querySelector(".product-grid").getBoundingClientRect()
        .bottom,
    }));
  assert(geometry.top >= geometry.bottom);
  const quote = view().locator(".request-options .button"),
    quoteURL = new URL(await quote.getAttribute("href"), origin);
  assert.equal(quoteURL.searchParams.get("model"), "yamaha-mt-25");
  assert.equal(quoteURL.searchParams.get("year"), "2024");
  await quote.click();
  await expect(view().getByLabel("Marka", { exact: true })).toHaveValue(
    "YAMAHA",
  );
  await expect(view().getByLabel("Model", { exact: true })).toHaveValue(
    "MT-25",
  );
  await expect(view().getByLabel("Yıl", { exact: true })).toHaveValue("2024");
  await fitment();
  const productName = await view()
    .locator(".product-card h3")
    .first()
    .innerText();
  await view().locator(".product-card").first().click();
  await expect(view().locator(".product-detail")).toBeVisible();
  const productURL = new URL(
    await view().locator(".request-options .button").getAttribute("href"),
    origin,
  );
  assert(productURL.searchParams.get("product"));
  await view().locator(".request-options .button").click();
  await expect(view().locator(".request-simple-form")).toBeVisible();
  await expect(view().getByLabel("Model", { exact: true })).toHaveValue(
    "MT-25",
  );
  await expect(view().locator('textarea[name="part_description"]')).toHaveValue(
    productName,
  );
  if (app) db.exec("DELETE FROM compatibility WHERE model_id='yamaha-mt-25'");
  else
    await page.evaluate((key) => {
      const c = JSON.parse(localStorage.getItem(key));
      c.compatibility = c.compatibility.filter(
        (f) => f.model_id !== "yamaha-mt-25",
      );
      localStorage.setItem(key, JSON.stringify(c));
    }, key);
  if (!app) await page.reload();
  await fitment();
  await expect(view().locator(".quote-request-empty")).toBeVisible();
  await expect(view().locator(".catalog-tools,.product-card")).toHaveCount(0);
  await expect(view().locator(".quote-request-empty .button")).toHaveCount(1);
  await page.screenshot({
    path: "/tmp/fitment-empty-" + (app ? "app" : "preview") + ".png",
    fullPage: true,
  });
  await view().locator(".quote-request-empty .button").click();
  await expect(view().getByLabel("Yıl", { exact: true })).toHaveValue("2024");
  const privacy = await browser.newContext();
  await privacy.addInitScript(() =>
    Object.defineProperty(navigator, "globalPrivacyControl", { value: true }),
  );
  const privatePage = await privacy.newPage();
  await privatePage.goto(origin + (app ? "/" : "/docs/store.html"));
  await expect(
    privatePage.getByRole("button", { name: "Kabul et", exact: true }),
  ).toBeDisabled();
  await privatePage
    .getByRole("button", { name: "Tercihleri yönet", exact: true })
    .click();
  await expect(
    privatePage.getByRole("checkbox", {
      name: "İstatistik ve ısı haritası",
      exact: true,
    }),
  ).toBeDisabled();
  assert.equal(
    await privatePage.evaluate(() =>
      sessionStorage.getItem("kz.analytics.tab"),
    ),
    null,
  );
  await privacy.close();
  assert.deepEqual(errors, []);
  console.log(
    `PASS (${app ? "app" : "preview"}): quote below products/centered when empty, bike and product context, explicit cookie choices, renewed consent on every reload, no prior tracking, mobile and GPC.`,
  );
} finally {
  await browser.close();
  db?.close();
  if (app) await server.stop();
  else {
    server.closeAllConnections();
    await new Promise((r) => server.close(r));
  }
}
