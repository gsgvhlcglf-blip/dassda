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
const key = "kuzmin.workspace.gsgvhlcglf-blip.dassda.v1";
try {
  const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    }),
    page = await context.newPage(),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
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
  const scale = async (value) => {
    await page.locator("#site-logo-scale").evaluate((input, value) => {
      input.value = String(value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }, value);
  };
  const guides = () => frame().locator("[data-kz-logo-guides]");
  await choose("ducati");
  await guides().waitFor({ state: "visible" });
  assert.equal(await frame().locator(".kz-logo-line").count(), 3);
  assert.equal(await frame().locator(".kz-logo-ghost").count(), 3);
  await page.getByLabel("Hizalama kılavuzu", { exact: true }).uncheck();
  await guides().waitFor({ state: "hidden" });
  await page.getByLabel("Hizalama kılavuzu", { exact: true }).check();
  await guides().waitFor({ state: "visible" });
  await frame()
    .getByRole("button", { name: "Kılavuzları kapat", exact: true })
    .click();
  await guides().waitFor({ state: "hidden" });
  assert.equal(
    await page.getByLabel("Hizalama kılavuzu", { exact: true }).isChecked(),
    false,
  );
  await page.reload();
  await frame().locator(".brand-card").first().waitFor();
  await choose("ducati");
  assert.equal(
    await page.getByLabel("Hizalama kılavuzu", { exact: true }).isChecked(),
    false,
  );
  await page.getByLabel("Hizalama kılavuzu", { exact: true }).check();
  await scale(80);
  await choose("bmw");
  await scale(130);
  await page.waitForFunction(
    (key) =>
      JSON.parse(localStorage.getItem(key + ".design")).logoScales[
        "brand:bmw"
      ] === 130,
    key,
  );
  const captions = () =>
    frame()
      .locator(".brand-card")
      .evaluateAll((cards) =>
        cards.map(
          (card) =>
            card.querySelector(".brand-discover").getBoundingClientRect().top -
            card.getBoundingClientRect().top,
        ),
      );
  const before = await captions();
  await page
    .getByRole("button", { name: "Hepsini hizala", exact: true })
    .click();
  await page.waitForFunction(() =>
    document
      .querySelector("#site-direct-status")
      ?.textContent.includes("Tüm logolar hizalandı"),
  );
  assert.equal(
    await page
      .getByRole("button", { name: "Hepsini hizala", exact: true })
      .isEnabled(),
    true,
  );
  const geometry = [];
  for (const brand of ["ducati", "bmw", "yamaha"]) {
    await choose(brand);
    await page.waitForFunction(
      (brand) =>
        document
          .querySelector("#site-frame")
          ?.contentDocument?.querySelector(".kz-logo-selected")?.dataset
          .logoKey ===
        "brand:" + brand,
      brand,
    );
    geometry.push(
      await frame()
        .locator(".kz-logo-selected")
        .evaluate((box) => {
          const r = box.getBoundingClientRect();
          return { height: r.height, centerY: r.top + r.height / 2 };
        }),
    );
  }
  assert.ok(
    Math.max(...geometry.map((r) => r.height)) -
      Math.min(...geometry.map((r) => r.height)) <
      1.6,
  );
  assert.ok(
    Math.max(...geometry.map((r) => r.centerY)) -
      Math.min(...geometry.map((r) => r.centerY)) <
      0.6,
  );
  assert.deepEqual(await captions(), before);
  await page.screenshot({ path: "/tmp/logo-guides.png", fullPage: true });
  const saved = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key + ".design")),
    key,
  );
  assert.equal(Object.keys(saved.logoOffsets).length, 3);
  await page.locator("#site-inspect").uncheck();
  await guides().waitFor({ state: "hidden" });
  await page.locator("#site-inspect").check();
  await guides().waitFor({ state: "visible" });
  const popup = context.waitForEvent("page");
  await page.getByRole("button", { name: "Müşteri önizlemesi ↗" }).click();
  const customer = await popup;
  await customer.locator(".brand-card").first().waitFor();
  assert.equal(await customer.locator("[data-kz-logo-guides]").count(), 0);
  // A transparent, off-center test logo verifies visible-pixel alignment, not just image-box alignment.
  await choose("ducati");
  const image = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 200;
    canvas.height = 200;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(35, 25, 110, 110);
    return canvas.toDataURL("image/png").split(",")[1];
  });
  await page.locator("#site-photo").setInputFiles({
    name: "transparent-test-logo.png",
    mimeType: "image/png",
    buffer: Buffer.from(image, "base64"),
  });
  await frame().locator(".brand-word.ducati img").waitFor();
  await choose("bmw");
  await page
    .getByRole("button", { name: "Hepsini hizala", exact: true })
    .click();
  await page.waitForFunction(
    (key) =>
      Math.abs(
        JSON.parse(localStorage.getItem(key + ".design")).logoOffsets[
          "brand:ducati"
        ].y,
      ) > 10,
    key,
  );
  const offset = await page.evaluate(
    (key) =>
      JSON.parse(localStorage.getItem(key + ".design")).logoOffsets[
        "brand:ducati"
      ],
    key,
  );
  assert.ok(offset.x > 4 && offset.y > 10);
  await page.getByRole("button", { name: "Mobil", exact: true }).click();
  await guides().waitFor({ state: "visible" });
  assert.equal(await frame().locator(".kz-logo-ghost").count(), 3);
  await page.reload();
  await frame().locator(".brand-card").first().waitFor();
  const restored = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key + ".design")),
    key,
  );
  assert.deepEqual(restored.logoOffsets["brand:ducati"], offset);
  assert.deepEqual(errors, []);
  console.log(
    "PASS: toggle/close/persisted guides, live measurements, align all to selected logo, stable captions, transparent padding, mobile, saved offsets and clean customer view.",
  );
} finally {
  await browser.close();
  await new Promise((r) => server.close(r));
}
