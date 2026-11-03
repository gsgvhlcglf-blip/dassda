import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
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
    calls = [];
  page.on("pageerror", (error) => errors.push(error.message));

  page.on("request", (request) => {
    if (request.url().includes("/api/")) calls.push(request.url());
  });
  await page.goto("http://localhost:4173/docs/panel.html");
  await context.route("https://carrier.example/**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<p>Test carrier response</p>",
    }),
  );
  const frame = () => page.frameLocator("#site-frame");
  await frame().locator(".hero h1").waitFor();
  const links = await frame().locator(".primary-nav>a").allTextContents();
  assert.deepEqual(links.slice(-3), ["Blog", "İletişim", "Kargo takip"]);
  await page.locator("#site-inspect").uncheck();
  await frame()
    .locator(".primary-nav")
    .getByRole("link", { name: "Blog", exact: true })
    .click();
  await frame().getByText("İlk yazılar yakında burada.").waitFor();
  await page.locator("#site-page").selectOption("tracking");
  await frame()
    .getByText(/Kargo firması henüz belirlenmedi/)
    .waitFor();
  await page.locator("#site-page").selectOption("checkout");
  await frame()
    .getByRole("heading", { name: "Devam etmek için üye girişi yapın." })
    .waitFor();
  await frame()
    .locator(".member-gate")
    .getByRole("link", { name: "Üye girişi", exact: true })
    .click();
  await frame().locator(".member-form").waitFor();
  assert.equal(
    await frame().locator(".member-form input[name=email]").isDisabled(),
    true,
  );
  await frame()
    .getByRole("button", { name: "Örnek üye ile devam et", exact: true })
    .click();
  await frame().locator(".checkout-form").waitFor();
  assert.equal(
    await frame().getByLabel("Ad soyad", { exact: true }).isDisabled(),
    true,
  );
  await page.getByRole("button", { name: "Veri paneli", exact: true }).click();
  await page
    .getByRole("button", { name: "Sayfa içerikleri", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Blog yazısı ekle", exact: true })
    .click();
  await page.getByLabel("Yazı URL adı", { exact: true }).fill("test-yazisi");
  await page
    .getByLabel("Başlık / TR", { exact: true })
    .fill("Deneme blog başlığı");
  await page
    .getByLabel("İçerik / TR", { exact: true })
    .fill("Sahibin düzenlediği gerçek bir metin.");
  await page
    .getByRole("button", { name: "Değişiklikleri kaydet ✓", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Sayfa önizlemeleri", exact: true })
    .click();
  await page.locator("#site-page").selectOption("blog");
  await frame()
    .locator(".blog-card")
    .filter({ hasText: "Deneme blog başlığı" })
    .click();
  await frame()
    .locator(".blog-article h1")
    .filter({ hasText: "Deneme blog başlığı" })
    .waitFor();
  await page.getByRole("button", { name: "Veri paneli", exact: true }).click();
  await page
    .getByRole("button", { name: "Taslak & yedek", exact: true })
    .click();
  await page.getByLabel("Kargo firması", { exact: true }).fill("Test firma");
  await page
    .getByLabel("HTTPS takip bağlantısı", { exact: true })
    .fill("https://carrier.example/track?number={tracking}");
  await page
    .getByRole("button", { name: "Kargo ayarlarını kaydet", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Sayfa önizlemeleri", exact: true })
    .click();
  await page.locator("#site-page").selectOption("tracking");
  await frame()
    .getByLabel("Kargo takip numarası", { exact: true })
    .fill("TRACK-123");
  const popupPromise = context.waitForEvent("page");
  await frame()
    .getByRole("button", { name: "Kargomu takip et", exact: true })
    .click();
  const popup = await popupPromise;
  await popup.waitForURL("https://carrier.example/track?number=TRACK-123");
  await popup.close();
  for (const lang of ["tr", "en", "ru"]) {
    await page.locator("#site-lang").selectOption(lang);
    await frame().locator(".tracking-page h1").waitFor();
    assert.equal(await frame().locator("html").getAttribute("lang"), lang);
  }
  await page.getByRole("button", { name: "Mobil", exact: true }).click();
  await frame().locator(".menu-toggle").click();
  assert.equal(await frame().locator(".primary-nav.open>a").count(), 7);
  assert.ok(
    await frame()
      .locator("html")
      .evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  );
  await page.screenshot({ path: "/tmp/member-preview.png", fullPage: true });
  assert.deepEqual(errors, []);
  assert.deepEqual(calls, []);
  console.log(
    "PASS: menu order, membership checkout gate, demo login without credentials, blog CMS publishing, configurable tracking URL, TR/EN/RU and mobile navigation.",
  );
} finally {
  await browser.close();
}
