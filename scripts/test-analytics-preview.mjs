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
  const origin = "http://127.0.0.1:" + server.address().port,
    key = "kuzmin.workspace.gsgvhlcglf-blip.dassda.v1.analytics-test";
  if (process.env.TEST_PROVIDER) {
    const loader = `<html><body><script>(async()=>{const html=await(await fetch(location.search.slice(1))).text();const doc=new DOMParser().parseFromString(html,'text/html');const scripts=[...doc.scripts].map(s=>s.textContent);doc.querySelectorAll('script').forEach(s=>s.remove());document.open();document.write(doc.documentElement.outerHTML);document.close();for(const text of scripts){const script=document.createElement('script');script.textContent=text;document.body.appendChild(script);}})()</script></body></html>`;
    await context.route("https://htmlpreview.github.io/**", (route) =>
      route.fulfill({ contentType: "text/html", body: loader }),
    );
    await context.route("https://raw.githubusercontent.com/**", (route) => {
      const name = route.request().url().includes("panel-version.json")
        ? "panel-version.json"
        : route.request().url().includes("store.html")
          ? "store.html"
          : "panel.html";
      return route.fulfill({
        contentType: name.endsWith("json") ? "application/json" : "text/plain",
        headers: { "Access-Control-Allow-Origin": "*" },
        body: readFileSync("docs/" + name),
      });
    });
  }
  await page.goto(
    process.env.TEST_PROVIDER
      ? "https://htmlpreview.github.io/?https://raw.githubusercontent.com/gsgvhlcglf-blip/dassda/test-release/docs/panel.html"
      : origin + "/docs/panel.html",
  );
  await page.frameLocator("#site-frame").locator(".hero h1").waitFor();
  await page.getByRole("button", { name: "Veri paneli", exact: true }).click();
  await page.locator('[data-action="section"][data-id="analytics"]').click();
  const dash = page.frameLocator("#analytics-panel-frame");
  await dash
    .getByRole("heading", { name: "Analitik & Isı Haritası", exact: true })
    .waitFor();
  await dash
    .getByRole("button", { name: "Test kaydını aç", exact: true })
    .waitFor();
  assert.equal(
    await dash.locator('[data-stat="Sayfa görüntüleme"]').textContent(),
    "0",
  );
  await dash
    .getByRole("button", { name: "Test kaydını aç", exact: true })
    .click();
  const popup = context.waitForEvent("page");
  await dash
    .getByRole("button", { name: "Müşteri önizlemesini aç ↗", exact: true })
    .click();
  const customer = await popup;
  customer.on("pageerror", (e) => errors.push(e.message));
  await customer.getByRole("button", { name: "Kabul et", exact: true }).click();
  if (process.env.TEST_PROVIDER)
    assert(customer.url().includes("/test-release/docs/store.html"));
  await customer
    .getByRole("button", { name: "Test kaydını başlat", exact: true })
    .waitFor();
  assert.equal(
    await customer.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)).events.length,
      key,
    ),
    0,
  );
  await customer
    .getByRole("button", { name: "Test kaydını başlat", exact: true })
    .click();
  await customer.waitForFunction(
    (key) =>
      JSON.parse(localStorage.getItem(key)).events.some(
        (e) => e.kind === "pageview",
      ),
    key,
  );
  await customer.locator(".hero h1").click();
  await customer.evaluate(() =>
    window.scrollTo(0, document.documentElement.scrollHeight),
  );
  await customer.waitForTimeout(800);
  await customer.waitForFunction(
    (key) =>
      JSON.parse(localStorage.getItem(key)).events.some(
        (e) => e.kind === "scroll",
      ),
    key,
  );
  await dash.getByRole("button", { name: "Yenile", exact: true }).click();
  await page.waitForFunction(
    () =>
      document
        .querySelector("#analytics-panel-frame")
        .contentDocument.querySelector('[data-stat="Tıklamalar"]')
        .textContent === "1",
  );
  const map = dash.frameLocator("iframe");
  await map.locator("[data-analytics-heatmap]").waitFor();
  await map.locator("[data-analytics-heatmap]").evaluate((canvas) => {
    if (!canvas.width || !canvas.height) throw Error("No heatmap size");
  });
  await page.waitForFunction(() => {
    const canvas = document
      .querySelector("#analytics-panel-frame")
      ?.contentDocument?.querySelector("iframe")
      ?.contentDocument?.querySelector("[data-analytics-heatmap]");
    return (
      canvas &&
      canvas
        .getContext("2d")
        .getImageData(0, 0, canvas.width, canvas.height)
        .data.some((value, index) => index % 4 === 3 && value > 0)
    );
  });
  const before = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)).events.length,
    key,
  );
  await map.locator(".hero h1").click({ force: true });
  await page.waitForTimeout(400);
  assert.equal(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)).events.length,
      key,
    ),
    before,
    "heatmap must not record itself",
  );
  await customer
    .getByRole("button", { name: "Test kaydını durdur", exact: true })
    .click();
  const stopped = await customer.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)).events.length,
    key,
  );
  await customer.locator(".hero h1").click();
  assert.equal(
    await customer.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)).events.length,
      key,
    ),
    stopped,
  );
  page.on("dialog", (d) => d.accept());
  await dash
    .getByRole("button", { name: "Kayıtları sil", exact: true })
    .click();
  await page.waitForFunction(
    (key) => JSON.parse(localStorage.getItem(key)).events.length === 0,
    key,
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "/tmp/kuzmin-analytics-mobile.png",
    fullPage: true,
  });
  assert.deepEqual(errors, []);
  console.log(
    "Analytics preview passed: empty state, opt-in, session/page/click/scroll, heatmap isolation, stop and clear.",
  );
} finally {
  await browser.close();
  await new Promise((r) => server.close(r));
}
