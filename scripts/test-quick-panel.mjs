import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const browser = await chromium.launch({
  executablePath:
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
try {
  const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
    }),
    errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("dialog", (dialog) => dialog.accept());
  await page.goto(
    process.env.TEST_PANEL_URL || "http://localhost:4173/docs/panel.html",
  );
  await page.getByRole("button", { name: "Veri paneli", exact: true }).click();
  assert.equal(
    await page
      .getByRole("heading", { name: "Genel bakış", exact: true })
      .count(),
    1,
  );
  await page.getByRole("button", { name: "+ Ürün ekle", exact: true }).click();
  await page
    .getByLabel("Ürün adı", { exact: true })
    .fill("Yeni test karbon parça");
  await page.getByLabel("SKU", { exact: true }).fill("TEST-QUICK-001");
  await page
    .getByLabel("Ürün fiyatı (TRY, KDV dahil)", { exact: true })
    .fill("4500");
  await page.getByLabel("Yayında", { exact: true }).check();
  await page.locator("#photo-file").setInputFiles("public/images/hero.webp");
  await page.waitForFunction(() =>
    document
      .querySelector(".photo-preview")
      ?.getAttribute("src")
      ?.startsWith("data:image/webp"),
  );
  await page
    .getByRole("button", { name: "Değişiklikleri kaydet ✓", exact: true })
    .click();
  assert.equal(await page.getByRole("dialog").count(), 0);
  await page.reload();
  await page.getByRole("button", { name: "Veri paneli", exact: true }).click();
  await page.getByRole("button", { name: "Ürünler", exact: true }).click();
  await page
    .getByLabel("Kayıtlarda ara", { exact: true })
    .fill("TEST-QUICK-001");
  assert.equal(await page.locator("tbody tr").count(), 1);
  await page
    .getByRole("button", { name: "Motosikletler", exact: true })
    .click();
  await page.getByRole("button", { name: "+ Yeni kayıt", exact: true }).click();
  await page.getByLabel("Model adı", { exact: true }).fill("Test model");
  await page
    .getByRole("button", { name: "+ Yıl aralığı ekle", exact: true })
    .click();
  await page.getByLabel("Başlangıç yılı 1", { exact: true }).fill("2024");
  await page.getByLabel("Bitiş yılı 1", { exact: true }).fill("2025");
  await page
    .getByLabel("Nesil açıklaması 1", { exact: true })
    .fill("Test nesli");
  await page
    .getByRole("button", { name: "Değişiklikleri kaydet ✓", exact: true })
    .click();
  await page.getByRole("button", { name: "Uyumluluk", exact: true }).click();
  await page.getByRole("button", { name: "+ Yeni kayıt", exact: true }).click();
  await page
    .getByLabel("Ürün", { exact: true })
    .selectOption({ label: "Yeni test karbon parça" });
  await page
    .getByLabel("Motosiklet modeli", { exact: true })
    .selectOption({ label: "Test model" });
  await page.getByLabel("İlk uyumlu yıl", { exact: true }).fill("2024");
  await page.getByLabel("Son uyumlu yıl", { exact: true }).fill("2025");
  await page
    .getByRole("button", { name: "Değişiklikleri kaydet ✓", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Uyumluluğu dene", exact: true })
    .click();
  await page.locator("#preview-brand").selectOption("yamaha");
  await page.locator("#preview-model").selectOption({ label: "Test model" });
  await page.locator("#preview-year").selectOption("2024");
  assert.equal(await page.locator(".product").count(), 1);
  assert.match(
    await page.locator(".product").innerText(),
    /Yeni test karbon parça/,
  );
  const exported = await page.evaluate(() =>
    JSON.parse(
      localStorage.getItem("kuzmin.workspace.gsgvhlcglf-blip.dassda.v1"),
    ),
  );
  assert.ok(
    exported.product_images.some((r) => r.url.startsWith("data:image/webp")),
  );
  await page
    .getByRole("button", { name: "Taslak & yedek", exact: true })
    .click();
  const download = page.waitForEvent("download");
  await page
    .locator("#view")
    .getByRole("button", { name: "Taslağı indir ↗", exact: true })
    .click();
  const file = await download;
  const path = await file.path();
  const backupFile = JSON.parse(readFileSync(path, "utf8"));
  assert.equal(backupFile.format, "kuzmin-workspace");
  const backup = backupFile.catalog;
  assert.ok(backup.products.some((p) => p.sku === "TEST-QUICK-001"));
  await page.getByRole("button", { name: "Taslak yükle", exact: true }).click();
  await page.locator("#import-file").setInputFiles({
    name: "broken.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({ ...backup, products: [{ id: "bad" }] }),
    ),
  });
  await page.waitForFunction(() =>
    document.querySelector("#toast").textContent.includes("Ürün"),
  );
  assert.equal(
    await page.evaluate(
      () =>
        JSON.parse(
          localStorage.getItem("kuzmin.workspace.gsgvhlcglf-blip.dassda.v1"),
        ).products.length,
    ),
    backup.products.length,
  );
  await page.getByRole("button", { name: "Genel bakış", exact: true }).click();
  await page.screenshot({
    path: "/tmp/quick-panel-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.locator("body").evaluate((e) => e.scrollWidth), 390);
  await page.screenshot({
    path: "/tmp/quick-panel-mobile.png",
    fullPage: true,
  });
  assert.deepEqual(errors, []);
  console.log(
    "PASS: create/edit catalog, photo upload, exact fitment preview, persistent reload, JSON export, invalid import rejection and mobile layout.",
  );
} finally {
  await browser.close();
}
