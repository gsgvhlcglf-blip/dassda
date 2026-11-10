import { dismissCookies } from "./test-cookie-helper.mjs";
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  executablePath:
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    permissions: ["clipboard-read", "clipboard-write"],
  });
  const page = await context.newPage(),
    errors = [],
    apiCalls = [];
  page.on("pageerror", (error) => {
    errors.push(error.message);
    console.log("Browser error:", error.message);
  });
  page.on("request", (request) => {
    if (/\/api\//.test(request.url())) apiCalls.push(request.url());
  });
  await page.goto(
    process.env.TEST_PANEL_URL || "http://localhost:4173/docs/panel.html",
  );
  const frame = () => page.frameLocator("#site-frame");
  await frame().locator(".hero h1").waitFor({ timeout: 20000 });
  await dismissCookies(frame());
  assert.match(
    await frame().locator(".hero h1").innerText(),
    /Detayda fark yarat/,
  );
  assert.ok(
    await page
      .locator("#site-preview-shell")
      .evaluate((el) => el.classList.contains("site-preview-expanded")),
  );
  assert.equal(await page.locator("#site-inspect").isChecked(), true);
  await page.locator("#site-inspect").uncheck();
  await frame().locator(".hero-video-canvas").waitFor();
  assert.equal(await frame().locator(".hero img").count(), 0);
  await page.screenshot({
    path: "/tmp/site-preview-desktop.png",
    fullPage: true,
  });
  console.log("PASS: visual-first homepage uses actual storefront.");
  const cases = {
    brands: ".brand-card",
    models: ".model-card",
    years: ".years a",
    fitment: ".product-card",
    catalog: ".catalog-tools",
    product: ".product-detail",
    cart: ".cart-line",
    checkout: ".checkout-form",
    about: ".prose-page",
    contact: ".prose-page",
    faq: ".prose-page",
    shipping: ".prose-page",
    distanceSales: ".legal-page",
    preInformation: ".legal-page",
    privacy: ".prose-page",
    terms: ".prose-page",
  };
  async function choose(value) {
    await page.locator("#site-page").selectOption(value);
    await page.waitForFunction(
      () => document.getElementById("site-loading")?.textContent === "Hazır",
    );
    await dismissCookies(frame());
  }
  for (const [id, selector] of Object.entries(cases)) {
    await choose(id);
    await frame().locator(selector).first().waitFor();
    if (id === "brands")
      assert.equal(await frame().locator(".brand-card").count(), 3);
    if (id === "checkout") {
      assert.ok(
        await frame().getByLabel("Ad soyad", { exact: true }).isDisabled(),
      );
      await frame()
        .getByRole("button", { name: "iyzico ile ödemeye geç", exact: true })
        .click();
      await frame().getByRole("alert").waitFor();
    }
  }
  console.log(
    "PASS: all storefront screens render; checkout preview cannot send requests.",
  );
  await choose("home");
  assert.equal(await page.locator("#site-lang").count(), 0);
  assert.equal(await frame().locator("#language").count(), 0);
  assert.equal(await frame().locator("html").getAttribute("lang"), "tr");
  await page.getByRole("button", { name: "Mobil", exact: true }).click();
  assert.equal(
    await frame()
      .locator("html")
      .evaluate(() => innerWidth),
    390,
  );
  assert.equal(
    await frame()
      .locator("body")
      .evaluate((el) => el.scrollWidth),
    390,
  );
  await page.screenshot({
    path: "/tmp/site-preview-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Tablet", exact: true }).click();
  assert.equal(
    await frame()
      .locator("html")
      .evaluate(() => innerWidth),
    768,
  );
  await page.getByRole("button", { name: "Masaüstü", exact: true }).click();
  assert.equal(
    await frame()
      .locator("html")
      .evaluate(() => innerWidth),
    1280,
  );
  await page.locator("#site-inspect").check();
  await frame().locator(".hero h1").click();
  await page.waitForFunction(() =>
    document
      .querySelector("#site-inspector h3")
      ?.textContent.includes("Ana başlık"),
  );
  await page.locator(".site-change-note summary").click();
  await page
    .getByLabel("Ne değişsin?", { exact: true })
    .fill("Başlığı biraz küçültelim.");
  const note = await page
    .getByLabel("Paylaşılacak değişiklik notu", { exact: true })
    .inputValue();
  assert.match(note, /home\.hero\.title/);
  assert.match(note, /Başlığı biraz küçültelim/);
  assert.ok(note.includes("\n"));
  await page.getByRole("button", { name: "Notu kopyala", exact: true }).click();
  assert.match(
    await page.evaluate(() => navigator.clipboard.readText()),
    /home\.hero\.title/,
  );
  await page
    .getByRole("button", { name: "Ana sayfa metnini düzenle ↗", exact: true })
    .click();
  const draftTitle = "Deneme tasarım başlığı <özel>";
  await page.getByLabel("Başlık / TR", { exact: true }).fill(draftTitle);
  await page
    .getByRole("button", { name: "Kaydet", exact: true })
    .count()
    .then(async (count) => {
      if (count)
        await page.getByRole("button", { name: "Kaydet", exact: true }).click();
      else
        await page
          .getByRole("button", { name: "Değişiklikleri kaydet ✓", exact: true })
          .click();
    });
  await frame().locator(".hero h1").waitFor();
  assert.equal(await frame().locator(".hero h1").innerText(), draftTitle);
  await page.reload();
  await dismissCookies(frame());
  await frame().locator(".hero h1").waitFor();
  assert.equal(await frame().locator(".hero h1").innerText(), draftTitle);
  assert.equal(await page.locator("#site-inspect").isChecked(), true);
  await page.locator("#site-inspect").uncheck();
  console.log(
    "PASS: three device sizes/Turkish, section targeting, note copy and live draft editing survive reload.",
  );
  await choose("brands");
  await frame().locator(".brand-card").filter({ hasText: "YAMAHA" }).click();
  await frame().getByRole("heading", { name: "Modelinizi seçin." }).waitFor();
  await frame().locator(".model-card").filter({ hasText: "MT-25" }).click();
  await frame().getByRole("link", { name: "2022–2026", exact: true }).click();
  await frame().locator(".product-card").first().click();
  await frame()
    .getByRole("button", { name: "Sepete ekle", exact: true })
    .click();
  await frame().locator(".bag-link").click();
  await frame().locator(".cart-line").first().waitFor();
  assert.equal(await page.locator("#site-page").inputValue(), "cart");
  await choose("product");
  await page.locator("#site-inspect").check();
  await frame().locator(".product-copy h1").click();
  await page.locator(".site-change-note summary").click();
  await page
    .getByRole("button", { name: "Ürün kaydını düzenle ↗", exact: true })
    .click();
  await page.getByLabel("Yayında", { exact: true }).uncheck();
  await page
    .getByRole("button", { name: "Değişiklikleri kaydet ✓", exact: true })
    .click();
  await frame()
    .getByRole("heading", { name: "Bu sayfa şu anda yayında değil." })
    .waitFor();
  assert.match(
    await page.locator("#site-product option:checked").innerText(),
    /Taslak/,
  );
  console.log(
    "PASS: unpublished products stay editable in the panel and close their preview detail page.",
  );
  assert.deepEqual(apiCalls, []);
  assert.deepEqual(errors, []);
  console.log(
    "PASS: in-preview brand/model/year/product/cart navigation stays inside the preview; no API requests.",
  );
} finally {
  await browser.close();
}
