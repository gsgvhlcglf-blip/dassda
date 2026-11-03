import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
const password =
  process.env.LOCAL_ADMIN_PASSWORD ||
  readFileSync(".env.local", "utf8").match(
    /^LOCAL_ADMIN_PASSWORD=(.+)$/m,
  )?.[1] ||
  "";
const stamp = Date.now().toString(),
  slug = `test-${stamp}`;
test("customer journey, persistence, Turkish-only storefront and a real demo order request", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Detayda fark yarat",
  );
  await page
    .getByRole("link", { name: "Motosikletini keşfet", exact: true })
    .first()
    .click();
  await page.locator(".brand-card").filter({ hasText: "YAMAHA" }).click();
  await expect(
    page.getByRole("heading", { name: "Modelinizi seçin." }),
  ).toBeVisible();
  await page.locator(".model-card").filter({ hasText: "MT-25" }).click();
  await page.getByRole("link", { name: "2024", exact: true }).click();
  await expect(page).toHaveURL(/yamaha\/mt-25\/2024/);
  await expect(page.locator(".product-card")).toHaveCount(6);
  await page.locator(".product-card").first().click();
  await page.getByRole("button", { name: "Sepete ekle", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Sepete eklendi");
  await page.reload();
  await page.getByRole("link", { name: "Sepet (1)", exact: true }).click();
  await page.getByRole("button", { name: "Adet +", exact: true }).click();
  await expect(page.locator(".cart-controls .quantity span")).toHaveText("2");
  await page
    .getByRole("link", { name: "Sipariş talebi oluştur", exact: true })
    .click();
  await expect(page).toHaveURL(/giris/);
  await page
    .locator(".member-form")
    .getByRole("link", { name: "Üye ol", exact: true })
    .click();
  await page
    .locator('.member-form input[name="email"]')
    .fill(`member-${stamp}@example.test`);
  await page
    .locator('.member-form input[name="password"]')
    .fill("Customer-test-123456");
  await page.locator('.member-form input[name="consent"]').check();
  await page
    .locator(".member-form")
    .getByRole("button", { name: "Üye ol", exact: true })
    .click();
  await expect(page).toHaveURL(/odeme/);
  await page.getByLabel("Ad soyad", { exact: true }).fill("Demo Customer");
  await page
    .getByLabel("E-posta", { exact: true })
    .fill(`test-${stamp}@example.test`);
  await page.getByLabel("Telefon", { exact: true }).fill("05000000000");
  await page
    .getByLabel("Teslimat adresi", { exact: true })
    .fill("Demo street 10, test address");
  await page.getByLabel("Verilerimin").check();
  await page
    .getByRole("button", { name: "Talebi gönder", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Talebiniz kaydedildi." }),
  ).toBeVisible();
  await expect(page.locator(".reference")).toContainText("KZ-");
  await expect(page.locator(".confirmation")).toContainText(
    "Gerçek bir sipariş veya ödeme oluşturulmadı",
  );
  await expect(page.locator("#language")).toHaveCount(0);
  await page.goto("/?lang=en");
  await expect(page.locator("html")).toHaveAttribute("lang", "tr");
  await expect(
    page
      .locator(".primary-nav")
      .getByRole("link", { name: "Motosikletler", exact: true }),
  ).toBeVisible();
});
test("anonymous users cannot administer, upload or forge orders", async ({
  request,
}) => {
  expect((await request.get("/api/admin")).status()).toBe(401);
  expect(
    (
      await request.post("/api/admin", {
        data: { table: "products", action: "delete", record: { id: "p1" } },
      })
    ).status(),
  ).toBe(401);
  expect((await request.post("/api/upload")).status()).toBe(401);
  expect(
    (
      await request.post("/api/orders", {
        data: {
          total: 1,
          lines: [{ productId: "p1", variantId: "wrong", quantity: 1 }],
        },
      })
    ).status(),
  ).toBe(401);
  expect(
    (
      await request.post("/api/auth", {
        headers: { origin: "https://malicious.test" },
        data: {},
      })
    ).status(),
  ).toBe(403);
});
test("owner can visually create a model, generation, year, product, variant, image and fitment", async ({
  page,
}) => {
  await page.goto("/admin");
  await page.getByLabel("Şifre", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Genel bakış", exact: true }),
  ).toBeVisible();
  async function section(label: string) {
    await page
      .locator(".admin-sidebar")
      .getByRole("button", { name: label, exact: true })
      .click();
  }
  async function create() {
    await page.getByRole("button", { name: "Yeni kayıt", exact: true }).click();
  }
  async function save() {
    await page.getByRole("button", { name: "Kaydet", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  }
  await section("Motosiklet modelleri");
  await create();
  await page.getByLabel("Marka", { exact: true }).selectOption("yamaha");
  await page
    .getByLabel("Model adı", { exact: true })
    .fill(`Test model ${stamp}`);
  await page
    .getByLabel("URL adı (küçük harf, tire)", { exact: true })
    .fill(slug);
  await save();
  await section("Nesiller");
  await create();
  await page
    .getByLabel("Motosiklet modeli", { exact: true })
    .selectOption({ label: `Test model ${stamp}` });
  await page
    .getByLabel("Nesil adı", { exact: true })
    .fill(`Test generation ${stamp}`);
  await page.getByLabel("İlk yıl", { exact: true }).fill("2024");
  await page.getByLabel("Son yıl", { exact: true }).fill("2026");
  await save();
  await section("Üretim yılları");
  await create();
  await page
    .getByLabel("Motosiklet modeli", { exact: true })
    .selectOption({ label: `Test model ${stamp}` });
  await page
    .getByLabel("Nesil", { exact: true })
    .selectOption({ label: `Test generation ${stamp}` });
  await page.getByLabel("Üretim yılı", { exact: true }).fill("2024");
  await save();
  await section("Ürünler");
  await create();
  await page
    .getByLabel("Ürün adı / TR", { exact: true })
    .fill(`Test product ${stamp}`);
  await page.getByLabel("URL adı", { exact: true }).fill(slug);
  await page.getByLabel("SKU", { exact: true }).fill(`TEST-${stamp}`);
  await page.getByLabel("Kategori", { exact: true }).selectOption("body");
  await page.getByLabel("Görünen fiyat (TRY)", { exact: true }).fill("1234");
  await page.getByLabel("Toplam stok", { exact: true }).fill("5");
  await page.getByLabel("Mağazada göster", { exact: true }).check();
  await save();
  await section("Varyantlar & stok");
  await create();
  await page
    .getByLabel("Ürün", { exact: true })
    .selectOption({ label: `Test product ${stamp}` });
  await page
    .getByLabel("Varyant adı / TR", { exact: true })
    .fill("Parlak test");
  await page.getByLabel("Varyant SKU", { exact: true }).fill(`TEST-G-${stamp}`);
  await page.getByLabel("Satış fiyatı (TRY)", { exact: true }).fill("1234");
  await page.getByLabel("Varyant stoku", { exact: true }).fill("5");
  await save();
  await section("Ürün fotoğrafları");
  await create();
  await page
    .getByLabel("Ürün", { exact: true })
    .selectOption({ label: `Test product ${stamp}` });
  await page
    .getByLabel("Fotoğraf yükle", { exact: true })
    .setInputFiles("public/images/hero.webp");
  await expect(page.locator(".upload-preview")).toBeVisible();
  await page
    .getByLabel("Görsel açıklaması / TR", { exact: true })
    .fill("Test concept artwork");
  await save();
  await section("Uyumluluk");
  await create();
  await page
    .getByLabel("Ürün", { exact: true })
    .selectOption({ label: `Test product ${stamp}` });
  await page
    .getByLabel("Motosiklet modeli", { exact: true })
    .selectOption({ label: `Test model ${stamp}` });
  await page
    .getByLabel("Nesil (isteğe bağlı)", { exact: true })
    .selectOption({ label: `Test generation ${stamp}` });
  await page.getByLabel("İlk uyumlu yıl", { exact: true }).fill("2024");
  await page.getByLabel("Son uyumlu yıl", { exact: true }).fill("2026");
  await save();
  await page.goto(`/motosikletler/yamaha/${slug}/2024`);
  await expect(page.locator(".product-card")).toHaveCount(1);
  await expect(page.locator(".product-card")).toContainText(
    `Test product ${stamp}`,
  );
  await page.locator(".product-card").click();
  await expect(
    page.getByRole("heading", { name: `Test product ${stamp}` }),
  ).toBeVisible();
  await expect(page.locator(".detail-main-image img")).toHaveAttribute(
    "src",
    /uploads/,
  );
  await page.getByRole("button", { name: "Sepete ekle", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Sepete eklendi");
  await page.goto("/admin");
  await section("Sipariş talepleri");
  await expect(page.locator(".admin-table")).toContainText("Demo Customer");
  await page
    .locator(".admin-table tbody tr")
    .first()
    .getByRole("button", { name: "Düzenle" })
    .click();
  await page
    .getByLabel("Sipariş durumu", { exact: true })
    .selectOption("reviewing");
  await save();
});
test("responsive screens, filtering and keyboard controls", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator("body")).toHaveJSProperty("scrollWidth", 390);
  await page.getByRole("button", { name: "Menü", exact: true }).click();
  await page
    .locator(".primary-nav")
    .getByRole("link", { name: "Motosikletler", exact: true })
    .click();
  await expect(page.locator(".brand-card")).toHaveCount(3);
  await page.goto("/urunler");
  await page
    .getByRole("textbox", { name: "Ürün veya SKU ara" })
    .fill("DEMO-KZ-001");
  await expect(page.locator(".product-card")).toHaveCount(1);
  await page
    .getByRole("textbox", { name: "Ürün veya SKU ara" })
    .fill("no-product-found");
  await expect(
    page.getByRole("heading", { name: "Bu seçim için henüz ürün bulunmuyor." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Filtreleri temizle" }).click();
  await expect(page.locator(".product-card").first()).toBeVisible();
  await expect(page.locator("body")).toHaveJSProperty("scrollWidth", 390);
});
test.afterAll(async ({ request }) => {
  const login = await request.post("/api/auth", {
    data: { email: "demo@local.test", password },
  });
  if (!login.ok()) return;
  const data = await (await request.get("/api/admin")).json();
  const models = (data.models || [])
    .filter((r: { slug: string }) => r.slug === slug)
    .map((r: { id: string }) => r.id);
  const products = (data.products || [])
    .filter((r: { slug: string }) => r.slug === slug)
    .map((r: { id: string }) => r.id);
  for (const table of [
    "compatibility",
    "product_images",
    "variants",
    "products",
    "model_years",
    "generations",
    "models",
  ])
    for (const r of data[table] || [])
      if (
        models.includes(r.id) ||
        models.includes(r.model_id) ||
        products.includes(r.id) ||
        products.includes(r.product_id)
      )
        await request.post("/api/admin", {
          data: { table, action: "delete", record: { id: r.id } },
        });
});
