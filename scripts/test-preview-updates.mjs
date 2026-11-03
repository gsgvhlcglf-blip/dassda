import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source = readFileSync("docs/panel.html", "utf8");
const previewMatch = source.match(/const PREVIEW = (\{[^\n]*\});/);
const initialMatch = source.match(/const INITIAL = (\{[^\n]*\});/);
assert.ok(previewMatch && initialMatch);
assert.equal(
  (source.match(/<script/gi) || []).length,
  1,
  "The preview provider must only transform the outer script",
);
const original = JSON.parse(previewMatch[1]);
const owner = JSON.parse(initialMatch[1]);
owner.content.find((c) => c.id === "home").title.tr = "Sahibin korunan başlığı";
owner.products[0].price = 1234;
function versioned(version, updates = []) {
  const next = structuredClone(original);
  next.version = version;
  next.updates = updates;
  next.css = Buffer.from(
    Buffer.from(next.css, "base64").toString() +
      "\n.product-copy h1{font-size:37px!important}",
  ).toString("base64");
  return source.replace(previewMatch[1], () => JSON.stringify(next));
}
let activeSource = source,
  activeVersion = original.version;
// Test-only transport, not a live-service availability check. It reproduces the provider's single-inline-script lifecycle.
const loader = `<html><body><p>Loading test preview</p><script>(async()=>{const url=location.search.slice(1);const html=await(await fetch(url)).text();const doc=new DOMParser().parseFromString(html,'text/html');const scripts=[...doc.scripts].map(s=>s.textContent);doc.querySelectorAll('script').forEach(s=>s.remove());document.open();document.write(doc.documentElement.outerHTML);document.close();for(const text of scripts){const script=document.createElement('script');script.textContent=text;document.body.appendChild(script);}})().catch(e=>{document.body.textContent=e.message})</script></body></html>`;
const browser = await chromium.launch({
  executablePath:
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(
    ({ catalog }) => {
      const key = "kuzmin.workspace.gsgvhlcglf-blip.dassda.v1";
      if (!localStorage.getItem(key)) {
        localStorage.setItem(key, JSON.stringify(catalog));
        localStorage.setItem(
          key + ".preview-ui",
          JSON.stringify({
            page: "product",
            device: "mobile",
            lang: "tr",
            product: "p1",
          }),
        );
      }
    },
    { catalog: owner },
  );
  await page.route("https://raw.githubusercontent.com/**", (route) => {
    const url = route.request().url();
    return route.fulfill({
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-store",
      },
      contentType: url.includes("panel-version.json")
        ? "application/json"
        : "text/plain",
      body: url.includes("panel-version.json")
        ? JSON.stringify({ version: activeVersion })
        : activeSource,
    });
  });
  await page.route("https://htmlpreview.github.io/**", (route) =>
    route.fulfill({ status: 200, contentType: "text/html", body: loader }),
  );
  await page.goto(
    "https://htmlpreview.github.io/?https://raw.githubusercontent.com/gsgvhlcglf-blip/dassda/main/docs/panel.html",
  );
  const frame = () => page.frameLocator("#site-frame");
  await frame().locator(".product-copy h1").waitFor();
  assert.equal(await page.locator("#site-page").inputValue(), "product");
  await page.locator("#site-inspect").check();
  await frame().locator(".product-copy h1").click();
  await page
    .getByRole("button", { name: "Ürün kaydını düzenle ↗", exact: true })
    .click();
  await page
    .getByLabel("Ürün adı", { exact: true })
    .fill("Kaydedilmemiş form değeri");
  activeVersion = "b".repeat(16);
  activeSource = versioned(activeVersion);
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await page.waitForFunction(
    () =>
      document.getElementById("site-update-status")?.textContent ===
      "Yeni tasarım hazır",
  );
  assert.ok(await page.getByRole("dialog").isVisible());
  assert.equal(
    await page.getByLabel("Ürün adı", { exact: true }).inputValue(),
    "Kaydedilmemiş form değeri",
  );
  await page.getByRole("button", { name: "Vazgeç", exact: true }).click();
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await page.waitForURL((url) => url.href.includes("v=" + activeVersion));
  await frame().locator(".product-copy h1").waitFor();
  await page.waitForFunction(
    () => document.getElementById("site-loading")?.textContent === "Hazır",
  );
  assert.equal(
    await frame()
      .locator(".product-copy h1")
      .evaluate((el) => getComputedStyle(el).fontSize),
    "37px",
  );
  assert.equal(await page.locator("#site-page").inputValue(), "product");
  assert.equal(
    await frame()
      .locator("html")
      .evaluate(() => innerWidth),
    390,
  );
  let saved = await page.evaluate(() =>
    JSON.parse(
      localStorage.getItem("kuzmin.workspace.gsgvhlcglf-blip.dassda.v1"),
    ),
  );
  assert.equal(
    saved.content.find((c) => c.id === "home").title.tr,
    "Sahibin korunan başlığı",
  );
  assert.equal(saved.products[0].price, 1234);
  assert.deepEqual(saved, owner);
  console.log(
    "PASS: design update reloads the current page/device, preserves owner drafts and defers while an editor is open.",
  );
  activeVersion = "c".repeat(16);
  activeSource = versioned(activeVersion, [
    {
      id: "test-requested-home-copy",
      table: "content",
      recordId: "home",
      changes: { title: { tr: "Yeni istenen başlık" } },
    },
  ]);
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await page.waitForURL((url) => url.href.includes("v=" + activeVersion));
  await frame().locator(".product-copy h1").waitFor();
  saved = await page.evaluate(() =>
    JSON.parse(
      localStorage.getItem("kuzmin.workspace.gsgvhlcglf-blip.dassda.v1"),
    ),
  );
  assert.equal(
    saved.content.find((c) => c.id === "home").title.tr,
    "Yeni istenen başlık",
  );
  assert.equal(saved.products[0].price, 1234);
  await page.evaluate(() => {
    const key = "kuzmin.workspace.gsgvhlcglf-blip.dassda.v1",
      value = JSON.parse(localStorage.getItem(key));
    value.content.find((c) => c.id === "home").title.tr =
      "Sahibin sonraki düzenlemesi";
    localStorage.setItem(key, JSON.stringify(value));
  });
  await page.reload();
  await frame().locator(".product-copy h1").waitFor();
  saved = await page.evaluate(() =>
    JSON.parse(
      localStorage.getItem("kuzmin.workspace.gsgvhlcglf-blip.dassda.v1"),
    ),
  );
  assert.equal(
    saved.content.find((c) => c.id === "home").title.tr,
    "Sahibin sonraki düzenlemesi",
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS: requested copy updates apply once and do not overwrite later owner edits.",
  );
} finally {
  await browser.close();
}
