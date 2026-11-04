import { chromium } from "@playwright/test";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
const key = "kuzmin.workspace.gsgvhlcglf-blip.dassda.v1";
const files = {
  "/docs/panel.html": readFileSync("docs/panel.html"),
  "/docs/store.html": readFileSync("docs/store.html"),
};
const server = createServer((req, res) => {
  const file = files[new URL(req.url, "http://localhost").pathname];
  res.statusCode = file ? 200 : 404;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.end(file || "Not found");
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
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
  page.on("dialog", (d) => d.accept());
  await page.addInitScript((key) => {
    if (!localStorage.getItem(key + ".design"))
      localStorage.setItem(
        key + ".design",
        JSON.stringify({
          texts: { tr: { "ui:chooseBrand": "Sahibin marka başlığı" } },
          images: {},
        }),
      );
  }, key);
  await page.goto(
    "http://127.0.0.1:" + server.address().port + "/docs/panel.html",
  );
  const frame = () => page.frameLocator("#site-frame");
  await frame().locator(".hero h1").waitFor();
  await page.locator("#site-page").selectOption("brands");
  await frame().locator(".brand-card").first().waitFor();
  const choose = async (brand) => {
    await frame()
      .locator(".brand-word." + brand)
      .click();
    await page.waitForFunction(
      (brand) =>
        document.querySelector("#site-logo-scale")?.dataset.logoKey ===
        "brand:" + brand,
      brand,
    );
  };
  const metrics = (brand) =>
    frame()
      .locator(".brand-word." + brand)
      .evaluate((el) => {
        const card = el.closest(".brand-card"),
          caption = card.querySelector(".brand-discover"),
          art = el.querySelector(".brand-logo-art");
        return {
          width: art.getBoundingClientRect().width,
          labelY:
            caption.getBoundingClientRect().top -
            card.getBoundingClientRect().top,
        };
      });
  const change = async (value) =>
    page
      .getByRole("slider", { name: "Logo ölçeği" })
      .evaluate((slider, value) => {
        slider.value = String(value);
        slider.dispatchEvent(new Event("input", { bubbles: true }));
      }, value);
  const waitScale = async (brand, scale) =>
    page.waitForFunction(
      ({ brand, scale }) => {
        const art = document
          .querySelector("#site-frame")
          ?.contentDocument?.querySelector(
            ".brand-word." + brand + " .brand-logo-art",
          );
        return (
          art &&
          Number(getComputedStyle(art).getPropertyValue("--brand-scale")) ===
            scale / 100
        );
      },
      { brand, scale },
    );
  await choose("ducati");
  const baseline = await metrics("ducati");
  await page.getByRole("slider", { name: "Logo ölçeği" }).focus();
  await page.getByRole("slider", { name: "Logo ölçeği" }).press("Home");
  await waitScale("ducati", 50);
  assert.equal(
    await page.locator("#site-logo-scale-value").textContent(),
    "%50",
  );
  const half = await metrics("ducati");
  assert.ok(Math.abs(half.width - baseline.width / 2) < 1);
  assert.equal(half.labelY, baseline.labelY);
  await choose("bmw");
  await change(120);
  await waitScale("bmw", 120);
  await choose("ducati");
  assert.equal(
    await page.getByRole("slider", { name: "Logo ölçeği" }).inputValue(),
    "50",
  );
  await change(90);
  await waitScale("ducati", 90);
  const snapshot = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key + ".design")),
    key,
  );
  assert.deepEqual(snapshot.logoScales, {
    "brand:ducati": 90,
    "brand:bmw": 120,
  });
  assert.equal(snapshot.texts.tr["ui:chooseBrand"], "Sahibin marka başlığı");
  await page.getByRole("button", { name: "Mobil", exact: true }).click();
  const mobile = await metrics("ducati");
  await change(125);
  await waitScale("ducati", 125);
  assert.equal((await metrics("ducati")).labelY, mobile.labelY);
  await page.reload();
  await frame().locator(".brand-card").first().waitFor();
  await choose("ducati");
  assert.equal(
    await page.getByRole("slider", { name: "Logo ölçeği" }).inputValue(),
    "125",
  );
  const popup = context.waitForEvent("page");
  await page.getByRole("button", { name: "Müşteri önizlemesi ↗" }).click();
  const customer = await popup;
  customer.on("pageerror", (e) => errors.push(e.message));
  await customer.locator(".brand-card").first().waitFor();
  await change(85);
  await waitScale("ducati", 85);
  await customer.waitForFunction(
    () =>
      Number(
        getComputedStyle(
          document.querySelector(".brand-word.ducati .brand-logo-art"),
        ).getPropertyValue("--brand-scale"),
      ) === 0.85,
  );
  await page.locator("#site-photo").setInputFiles("public/images/hero.webp");
  await frame().locator(".brand-word.ducati .brand-logo-image").waitFor();
  assert.equal(
    await page.getByRole("slider", { name: "Logo ölçeği" }).inputValue(),
    "85",
  );
  await page.getByRole("button", { name: "Veri paneli", exact: true }).click();
  await page
    .getByRole("button", { name: "Taslak & yedek", exact: true })
    .click();
  const downloadPromise = page.waitForEvent("download");
  await page
    .locator("#view")
    .getByRole("button", { name: "Taslağı indir ↗", exact: true })
    .click();
  const download = await downloadPromise;
  const backup = JSON.parse(readFileSync(await download.path(), "utf8"));
  assert.equal(backup.design.logoScales["brand:ducati"], 85);
  await page
    .getByRole("button", { name: "Sayfa önizlemeleri", exact: true })
    .click();
  await frame().locator(".brand-card").first().waitFor();
  await choose("ducati");
  await page
    .getByRole("button", { name: "Varsayılan boyuta dön", exact: true })
    .click();
  await waitScale("ducati", 100);
  await page.getByRole("button", { name: "Veri paneli", exact: true }).click();
  await page
    .getByRole("button", { name: "Taslak & yedek", exact: true })
    .click();
  await page.locator("#import-file").setInputFiles({
    name: "scale-backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(backup)),
  });
  await page.waitForFunction(
    (key) =>
      JSON.parse(localStorage.getItem(key + ".design")).logoScales[
        "brand:ducati"
      ] === 85,
    key,
  );
  await page
    .getByRole("button", { name: "Sayfa önizlemeleri", exact: true })
    .click();
  await frame().locator(".brand-card").first().waitFor();
  await choose("ducati");
  assert.equal(
    await page.getByRole("slider", { name: "Logo ölçeği" }).inputValue(),
    "85",
  );
  await page.locator(".site-direct-photo").evaluate((image) => image.decode());
  assert.deepEqual(errors, []);
  await page.screenshot({ path: "/tmp/logo-scale-editor.png", fullPage: true });
  console.log(
    "PASS: keyboard/live scale changes, independent brand values, stable captions, legacy drafts, mobile, reload, customer sync, image replacement, reset and backup/import.",
  );
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
