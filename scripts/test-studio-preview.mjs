import { chromium } from "@playwright/test";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
const files = {
  "/docs/panel.html": readFileSync("docs/panel.html"),
  "/docs/store.html": readFileSync("docs/store.html"),
};
const server = createServer((req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.end(files[new URL(req.url, "http://localhost").pathname] || "Not found");
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
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
  if (process.env.TEST_PROVIDER) {
    const loader = `<html><body><script>(async()=>{const html=await(await fetch(location.search.slice(1))).text();const doc=new DOMParser().parseFromString(html,'text/html');const scripts=[...doc.scripts].map(s=>s.textContent);doc.querySelectorAll('script').forEach(s=>s.remove());document.open();document.write(doc.documentElement.outerHTML);document.close();for(const text of scripts){const script=document.createElement('script');script.textContent=text;document.body.appendChild(script);}})()</script></body></html>`;
    await context.route("https://htmlpreview.github.io/**", (r) =>
      r.fulfill({ contentType: "text/html", body: loader }),
    );
    await context.route("https://raw.githubusercontent.com/**", (r) => {
      const name = r.request().url().includes("panel-version.json")
        ? "panel-version.json"
        : r.request().url().includes("store.html")
          ? "store.html"
          : "panel.html";
      return r.fulfill({
        contentType: name.endsWith("json") ? "application/json" : "text/plain",
        headers: { "Access-Control-Allow-Origin": "*" },
        body: readFileSync("docs/" + name),
      });
    });
  }
  const origin = "http://127.0.0.1:" + server.address().port;
  await page.goto(
    process.env.TEST_PROVIDER
      ? "https://htmlpreview.github.io/?https://raw.githubusercontent.com/gsgvhlcglf-blip/dassda/test-release/docs/panel.html"
      : origin + "/docs/panel.html",
  );
  const frame = () => page.frameLocator("#site-frame");
  await frame().locator(".hero h1").waitFor();
  await frame().locator(".hero h1").click();
  await page.getByLabel("Seçili metni düzenle").fill("Draft first title");
  const popup = context.waitForEvent("page");
  await page
    .getByRole("button", { name: "Müşteri önizlemesi ↗", exact: true })
    .click();
  const draft = await popup;
  draft.on("pageerror", (e) => errors.push(e.message));
  await draft
    .getByRole("heading", { name: "Draft first title", exact: true })
    .waitFor();
  const publishedPopup = context.waitForEvent("page");
  await page
    .getByRole("button", { name: "Yayımlananı gör ↗", exact: true })
    .click();
  const published = await publishedPopup;
  published.on("pageerror", (e) => errors.push(e.message));
  await published.locator(".hero h1").waitFor();
  assert.notEqual(
    await published.locator(".hero h1").innerText(),
    "Draft first title",
  );
  await page.locator('[data-action="site-release"]').click();
  await page.locator("#studio-release-label").fill("First reviewed release");
  await page
    .getByRole("button", { name: "Taslağı yayınla", exact: true })
    .click();
  await published
    .getByRole("heading", { name: "Draft first title", exact: true })
    .waitFor();
  await page
    .locator('.nav [data-action="section"][data-id="sitePreview"]')
    .click();
  await frame().locator(".hero h1").waitFor();
  await frame().locator(".hero h1").click();
  await page.getByLabel("Seçili metni düzenle").fill("Second draft title");
  await draft
    .getByRole("heading", { name: "Second draft title", exact: true })
    .waitFor();
  assert.equal(
    await published.locator(".hero h1").innerText(),
    "Draft first title",
  );
  await page.locator('[data-action="site-release"]').click();
  await page.locator("#studio-release-label").fill("Second reviewed release");
  await page
    .getByRole("button", { name: "Taslağı yayınla", exact: true })
    .click();
  await published
    .getByRole("heading", { name: "Second draft title", exact: true })
    .waitFor();
  page.on("dialog", (d) => d.accept());
  await page
    .locator(".studio-version")
    .filter({ hasText: "First reviewed release" })
    .getByRole("button", { name: "Bu sürüme dön", exact: true })
    .click();
  await published
    .getByRole("heading", { name: "Draft first title", exact: true })
    .waitFor();
  await draft
    .getByRole("heading", { name: "Draft first title", exact: true })
    .waitFor();
  await page
    .getByText("Geri almadan önceki taslak", { exact: false })
    .first()
    .waitFor();
  await page.locator('[data-action="section"][data-id="photography"]').click();
  await page.locator("#studio-photo-aspect").selectOption("portrait");
  await page.locator("#studio-photo-background").selectOption("light");
  const photos = page.frameLocator("#photo-preview-frame");
  await photos.locator(".product-visual").first().waitFor();
  await page.waitForFunction(
    () =>
      getComputedStyle(
        document
          .querySelector("#photo-preview-frame")
          .contentDocument.querySelector(".product-visual"),
      ).aspectRatio === "4 / 5",
  );
  await page
    .locator('.nav [data-action="section"][data-id="sitePreview"]')
    .click();
  await page.locator("#site-page").selectOption("product");
  await frame().locator(".detail-main-image img").click();
  await page
    .getByLabel("Fotoğraf ölçeği", { exact: true })
    .evaluate((input) => {
      input.value = "125";
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
  await page.getByLabel("Fotoğraf çekim türü").selectOption("texture");
  await frame().getByText("Doku detayı", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Veri paneli", exact: true }).click();
  await page.locator('[data-action="section"][data-id="analytics"]').click();
  const analytics = page.frameLocator("#analytics-panel-frame");
  await analytics
    .getByRole("button", { name: "Test kaydını aç", exact: true })
    .click();
  await draft.goto(draft.url().split("#")[0] + "#/motosikletler");
  await draft
    .getByRole("button", { name: "Test kaydını başlat", exact: true })
    .click();
  await draft.locator(".brand-card").filter({ hasText: "YAMAHA" }).click();
  await draft.locator(".model-card").filter({ hasText: "MT-25" }).click();
  await draft.getByRole("link", { name: "2024", exact: true }).click();
  await draft.locator(".product-card").first().click();
  await draft.getByRole("button", { name: "Sepete ekle", exact: true }).click();
  await analytics.getByRole("button", { name: "Yenile", exact: true }).click();
  await page.waitForFunction(
    () =>
      document
        .querySelector("#analytics-panel-frame")
        .contentDocument.querySelector('[data-funnel-count="5"]')
        .textContent === "1",
  );
  await analytics.getByLabel("Alışveriş akışı cihazı").selectOption("Mobil");
  assert.equal(
    await analytics.locator('[data-funnel-count="0"]').innerText(),
    "0",
  );
  await analytics.getByLabel("Alışveriş akışı cihazı").selectOption("Masaüstü");
  assert.equal(
    await analytics.locator('[data-funnel-count="5"]').innerText(),
    "1",
  );
  await page.screenshot({
    path: "/tmp/kuzmin-studio-funnel.png",
    fullPage: true,
  });
  assert.deepEqual(errors, []);
  console.log(
    "Studio preview passed: separate draft/published tabs, publish, rollback, preserved draft backup, global photo framing, per-image controls and ordered/device funnel.",
  );
} finally {
  await browser.close();
  await new Promise((r) => server.close(r));
}
