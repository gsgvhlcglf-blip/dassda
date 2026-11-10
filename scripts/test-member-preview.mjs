import { dismissCookies } from "./test-cookie-helper.mjs";
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
  await dismissCookies(frame());
  await frame().locator(".hero h1").waitFor();
  const links = await frame().locator(".primary-nav>a").allTextContents();
  assert.deepEqual(links, [
    "Ana sayfa",
    "Motosikletler",
    "Parçanı ürettir",
    "Hakkımızda",
    "Blog",
    "İletişim",
  ]);
  assert.equal(
    await frame().locator('.footer-nav a[href="/urunler"]').count(),
    0,
  );
  assert.equal(await frame().locator(".member-links a").count(), 0);
  assert.equal(
    await page
      .locator(
        '#site-page option[value="login"],#site-page option[value="signup"],#site-page option[value="account"]',
      )
      .count(),
    0,
  );
  const footer = await frame()
    .locator(".footer-nav")
    .locator("a")
    .allTextContents();
  assert.deepEqual(footer, [
    "Sık sorulan sorular",
    "Kargo takip",
    "Gizlilik ve Çerez Politikası",
    "Mesafeli Satış Sözleşmesi",
    "Ön Bilgilendirme Formu",
    "İptal ve İade Koşulları",
    "Kullanıcı Sözleşmesi / Şartlar ve Koşullar",
  ]);
  assert.equal(
    await frame()
      .locator(".footer-title,footer .eyebrow,footer a[href='/admin']")
      .count(),
    0,
  );
  await page.locator("#site-inspect").uncheck();
  await frame()
    .locator(".primary-nav")
    .getByRole("link", { name: "Blog", exact: true })
    .click();
  assert.equal(await frame().locator(".blog-card").count(), 3);
  await page.locator("#site-page").selectOption("tracking");
  await dismissCookies(frame());
  await frame()
    .getByText(/Kargo firması henüz belirlenmedi/)
    .waitFor();
  await page.locator("#site-page").selectOption("checkout");
  await dismissCookies(frame());
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
  await dismissCookies(frame());
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
  await dismissCookies(frame());
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
  assert.equal(await page.locator("#site-lang").count(), 0);
  assert.equal(await frame().locator("#language").count(), 0);
  assert.equal(await frame().locator("html").getAttribute("lang"), "tr");
  await page.getByRole("button", { name: "Mobil", exact: true }).click();
  await frame().locator(".menu-toggle").click();
  assert.equal(await frame().locator(".primary-nav.open>a").count(), 6);
  assert.ok(
    await frame()
      .locator("html")
      .evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  );
  await page.screenshot({ path: "/tmp/member-preview.png", fullPage: true });
  assert.deepEqual(errors, []);
  assert.deepEqual(calls, []);
  console.log(
    "PASS: menu order, guest checkout without account controls, blog CMS publishing, configurable tracking URL, Turkish-only and mobile navigation.",
  );
} finally {
  await browser.close();
}
