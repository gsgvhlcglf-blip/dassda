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
    errors = [],
    requests = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => {
    if (r.url().includes("/api/payments")) requests.push(r.url());
  });
  await page.goto(
    "http://127.0.0.1:" + server.address().port + "/docs/panel.html",
  );
  const frame = () => page.frameLocator("#site-frame");
  await frame().locator(".hero h1").waitFor();
  await page.locator("#site-page").selectOption("models");
  const model = frame().locator(".model-art").first();
  await model.waitFor();
  assert.equal(
    await model.evaluate((e) => getComputedStyle(e).backgroundColor),
    "rgba(0, 0, 0, 0)",
  );
  assert.equal(
    await model.evaluate((e) => getComputedStyle(e).backgroundImage),
    "none",
  );
  await model.locator("img").click();
  const png = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 300;
    c.height = 200;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#c74634";
    ctx.fillRect(80, 65, 140, 80);
    return c.toDataURL("image/png").split(",")[1];
  });
  await page.locator("#site-photo").setInputFiles({
    name: "transparent-model.png",
    mimeType: "image/png",
    buffer: Buffer.from(png, "base64"),
  });
  await page.waitForFunction(() =>
    document
      .querySelector("#site-frame")
      ?.contentDocument?.querySelector(".model-art img")
      ?.src.startsWith("data:image/webp"),
  );
  assert.equal(
    await model.locator("img").evaluate(async (img) => {
      await img.decode();
      const c = document.createElement("canvas");
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const ctx = c.getContext("2d");
      ctx.drawImage(img, 0, 0);
      return ctx.getImageData(0, 0, 1, 1).data[3];
    }),
    0,
  );
  await page.screenshot({
    path: "/tmp/kuzmin-transparent-motorcycle.png",
    fullPage: true,
  });
  await page.locator("#site-page").selectOption("years");
  const yearImage = frame().locator(".year-image");
  await yearImage.waitFor();
  assert.equal(await yearImage.evaluate((e) => getComputedStyle(e).backgroundColor), "rgba(0, 0, 0, 0)");
  assert.equal(await yearImage.evaluate((e) => getComputedStyle(e).backgroundImage), "none");
  await page.screenshot({path:"/tmp/kuzmin-transparent-motorcycle-year.png",fullPage:true});
  await page.getByRole("button", { name: "Veri paneli", exact: true }).click();
  await page.locator('.nav [data-id="payments"]').click();
  await page.getByLabel("Planlanan ödeme sağlayıcısı").selectOption("paytr");
  await page
    .getByRole("button", { name: "Tercihi kaydet", exact: true })
    .click();
  assert.match(
    await page.locator("#payment-plan-feedback").innerText(),
    /kaydedildi/,
  );
  assert.equal(await page.locator("input[type=password]").count(), 0);
  await page.reload();
  await page.getByRole("button", { name: "Veri paneli", exact: true }).click();
  await page.locator('.nav [data-id="payments"]').click();
  assert.equal(
    await page.getByLabel("Planlanan ödeme sağlayıcısı").inputValue(),
    "paytr",
  );
  await page.getByLabel("Planlanan ödeme sağlayıcısı").selectOption("iyzico");
  await page
    .getByRole("button", { name: "Tercihi kaydet", exact: true })
    .click();
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.locator("body").evaluate((e) => e.scrollWidth), 390);
  assert.deepEqual(errors, []);
  assert.deepEqual(requests, []);
  console.log(
    "Payment preview passed: transparent container, retained PNG alpha, provider preference persistence, no secret inputs, no payment API calls and mobile layout.",
  );
} finally {
  await browser.close();
  await new Promise((r) => server.close(r));
}
