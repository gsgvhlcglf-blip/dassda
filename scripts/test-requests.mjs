import { chromium, expect } from "@playwright/test";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { testAppServer } from "./test-app-server.mjs";
const app = process.argv.includes("--app"),
  key = "kuzmin.workspace.gsgvhlcglf-blip.dassda.v1";
let server, origin;
if (app) {
  server = await testAppServer();
  origin = server.origin;
} else {
  server = createServer((req, res) => {
    const p = new URL(req.url, "http://localhost").pathname;
    if (!/^\/docs\/(panel\.html|store\.html|panel-version\.json)$/.test(p))
      return res.writeHead(404).end();
    res.setHeader(
      "Content-Type",
      p.endsWith("json") ? "application/json" : "text/html; charset=utf-8",
    );
    res.end(readFileSync("." + p));
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  origin = "http://127.0.0.1:" + server.address().port;
}
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==",
  "base64",
);
try {
  const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    }),
    page = await context.newPage(),
    errors = [];
  context.setDefaultTimeout(15000);
  page.on("pageerror", (e) => errors.push(e.message));
  const frame = () => (app ? page : page.frameLocator("#site-frame"));
  await page.goto(
    origin + (app ? "/motosikletler/yamaha/mt-25/2024" : "/docs/panel.html"),
  );
  if (!app) {
    await frame().locator(".hero").waitFor();
    await page.locator("#site-page").selectOption("fitment");
    await page.locator("#site-inspect").uncheck();
  }
  await frame().locator(".request-options").waitFor();
  assert.equal(
    await frame().locator(".request-option-grid article").count(),
    2,
  );
  await frame()
    .getByRole("combobox", { name: "Koleksiyon", exact: true })
    .selectOption("body");
  await frame()
    .getByRole("link", { name: /Ürün talebi oluştur/ })
    .click();
  await expect(frame().getByLabel("Marka", { exact: true })).toHaveValue(
    "yamaha",
  );
  await expect(frame().getByLabel("Model", { exact: true })).toHaveValue(
    "yamaha-mt-25",
  );
  await expect(frame().getByLabel("Model yılı", { exact: true })).toHaveValue(
    "2024",
  );
  await expect(
    frame().getByLabel("Parça kategorisi", { exact: true }),
  ).toHaveValue("body");
  async function fillForm(view, kind, email) {
    await view
      .getByLabel("İstenen karbonfiber parça", { exact: true })
      .fill(
        kind === "demand" ? "Test talep paneli" : "Test özel üretim paneli",
      );
    await view
      .getByLabel(
        kind === "custom"
          ? "Üretim için referans alınabilecek orijinal parçayı bize sağlayabilir misiniz?"
          : "Orijinal parçaya erişim durumu",
        { exact: true },
      )
      .selectOption(kind === "custom" ? "unavailable" : "can_ship");
    await view
      .getByLabel("Ad soyad", { exact: true })
      .fill("Test request customer");
    await view.getByLabel("E-posta", { exact: true }).fill(email);
    await view.locator('input[name="permission"]').check();
  }
  await fillForm(frame(), "demand", "requests-browser@example.test");
  let demandRef, customRef;
  if (app) {
    await page
      .getByLabel(/Referans fotoğrafları/)
      .setInputFiles({
        name: "reference.png",
        mimeType: "image/png",
        buffer: png,
      });
    await page
      .getByRole("button", { name: "Ürün talebini gönder", exact: true })
      .click();
    await page.getByText(/KZ-UT-/).waitFor();
    demandRef = await page.locator(".request-thanks strong").innerText();
  } else {
    const calls = [];
    page.on("request", (r) => {
      if (r.url().includes("/api/requests")) calls.push(r.url());
    });
    await frame()
      .getByRole("button", { name: "Ürün talebini gönder", exact: true })
      .click();
    await frame()
      .getByRole("alert")
      .filter({ hasText: /taslak önizlemesi/ })
      .waitFor();
    assert.deepEqual(calls, []);
    assert(
      !(await page.evaluate(() => JSON.stringify(localStorage))).includes(
        "requests-browser@example.test",
      ),
    );
  }
  if (app) {
    await page.goto(
      origin +
        "/parcani-urettir?type=custom&brand=yamaha&model=yamaha-mt-25&year=2024&category=body",
    );
    await fillForm(page, "custom", "custom-browser@example.test");
    await page.getByLabel(/Referans fotoğrafları/).setInputFiles([
      { name: "one.png", mimeType: "image/png", buffer: png },
      { name: "two.png", mimeType: "image/png", buffer: png },
    ]);
    await page
      .getByRole("button", { name: "Özel üretim talebini gönder", exact: true })
      .click();
    await page.getByText(/KZ-OZ-/).waitFor();
    customRef = await page.locator(".request-thanks strong").innerText();
    const admin = await browser.newContext({
        viewport: { width: 1440, height: 1000 },
      }),
      panel = await admin.newPage();
    panel.on("pageerror", (e) => errors.push(e.message));
    assert.equal(
      (await context.request.get(origin + "/api/admin/requests")).status(),
      401,
    );
    await panel.goto(origin + "/admin");
    await panel.getByLabel("Şifre", { exact: true }).fill(server.password);
    await panel.getByRole("button", { name: "Giriş yap", exact: true }).click();
    await panel
      .getByRole("heading", { name: "Genel bakış", exact: true })
      .waitFor();
    await panel
      .getByRole("button", { name: "Talepler & CRM", exact: true })
      .click();
    const data = await (
      await admin.request.get(origin + "/api/admin/requests")
    ).json();
    assert.equal(data.records.length, 2);
    const demand = data.records.find((r) => r.reference === demandRef),
      custom = data.records.find((r) => r.reference === customRef);
    assert.equal(demand.input.category_id, "body");
    assert.equal(demand.input.model_id, "yamaha-mt-25");
    assert(custom.technical_review);
    const detail = await (
      await admin.request.get(origin + "/api/admin/requests?id=" + custom.id)
    ).json();
    assert.equal(detail.files.length, 2);
    assert.equal(
      (await context.request.get(origin + detail.files[0].url)).status(),
      401,
    );
    assert.equal(
      (await admin.request.get(origin + detail.files[0].url)).status(),
      200,
    );
    // Idempotency protects repeated guest submissions; private records have no guest read API.
    const payload = {
      ...demand.input,
      submission_key: crypto.randomUUID(),
      email: "idempotent@example.test",
    };
    const multipart = { payload: JSON.stringify(payload) };
    const one = await context.request.post(origin + "/api/requests", {
        multipart,
      }),
      two = await context.request.post(origin + "/api/requests", { multipart });
    assert.equal(one.status(), 201, await one.text());
    assert.equal((await one.json()).reference, (await two.json()).reference);
    const invalid = await context.request.post(origin + "/api/requests", {
      multipart: {
        payload: JSON.stringify({
          ...payload,
          submission_key: crypto.randomUUID(),
        }),
        photos: {
          name: "unsafe.svg",
          mimeType: "image/svg+xml",
          buffer: Buffer.from(
            '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
          ),
        },
      },
    });
    assert.equal(invalid.status(), 400);
    await panel
      .locator("tbody tr")
      .filter({ hasText: customRef })
      .getByRole("button", { name: /Talebi aç/ })
      .click();
    await panel
      .getByLabel("Talep aşaması", { exact: true })
      .selectOption("awaiting_part");
    await panel
      .getByLabel("Durum değişikliği açıklaması", { exact: true })
      .fill("Test shipping guard");
    await panel
      .getByRole("button", { name: "Aşamayı kaydet", exact: true })
      .click();
    await panel
      .getByRole("alert")
      .filter({ hasText: /gönderim koşullarını/ })
      .waitFor();
    await panel
      .getByLabel("Talep aşaması", { exact: true })
      .selectOption("review");
    await panel
      .getByLabel("Durum değişikliği açıklaması", { exact: true })
      .fill("Teknik inceleme başladı.");
    await panel
      .getByRole("button", { name: "Aşamayı kaydet", exact: true })
      .click();
    await panel
      .getByRole("status")
      .filter({ hasText: /güncellendi/ })
      .waitFor();
    await panel
      .getByRole("button", { name: "Tüm talepler", exact: true })
      .click();
    await panel
      .getByRole("button", { name: "Koşul dokümanları", exact: true })
      .click();
    for (const title of [
      "Referans parçanın mülkiyeti",
      "Hasar ve risk koşulları",
      "İade koşulları",
      "Kalıp kullanım hakları",
    ])
      await panel
        .getByLabel(title + " metni", { exact: true })
        .fill(
          "Yalnızca test için koşul metni; ticari veya hukuki kullanım için değildir.",
        );
    for (const box of await panel.getByRole("checkbox").all())
      await box.check();
    await panel
      .getByRole("button", { name: "Koşul sürümünü kaydet", exact: true })
      .click();
    await panel.getByText(/Koşullar yeni bir sürüm/).waitFor();
    assert.equal(
      (
        await (
          await context.request.get(origin + "/api/requests/settings")
        ).json()
      ).version,
      1,
    );
    await panel
      .getByRole("button", { name: "Başvurular", exact: true })
      .click();
    await panel
      .locator("tbody tr")
      .filter({ hasText: customRef })
      .getByRole("button", { name: /Talebi aç/ })
      .click();
    await panel
      .getByLabel("Müşteri onay tarihi", { exact: true })
      .fill("2026-11-06");
    await panel
      .getByLabel("Müşteri onay kaydı / kanıtı", { exact: true })
      .fill("Test onay kaydı alındı.");
    await panel
      .getByLabel("İletilen gönderim koşulları", { exact: true })
      .fill("Test gönderim koşulları iletildi.");
    await panel
      .getByRole("checkbox", { name: /Koşullar müşteriye iletildi/ })
      .check();
    await panel
      .getByRole("button", { name: "Takip bilgilerini kaydet", exact: true })
      .click();
    await panel
      .getByRole("status")
      .filter({ hasText: /güncellendi/ })
      .waitFor();
    await panel.getByLabel("Tutar (TRY)", { exact: true }).fill("12500");
    await panel
      .getByLabel("Fiyat ve koşul açıklaması", { exact: true })
      .fill("Test ön teklifi");
    await panel
      .getByRole("button", { name: "Teklif sürümü kaydet", exact: true })
      .click();
    await panel.getByText(/v1 · Ön teklif/).waitFor();
    await panel
      .getByLabel("İletim kanalı ve tarih kaydı", { exact: true })
      .fill("Test telefon görüşmesinde iletildi.");
    await panel
      .getByRole("button", { name: "İletildi olarak kaydet", exact: true })
      .click();
    await panel
      .getByLabel("Müşteri onay kanıtı / kanal / tarih", { exact: true })
      .fill("Test müşteri onay kaydı.");
    await panel
      .getByRole("button", { name: "Müşteri onayını kaydet", exact: true })
      .click();
    await panel.getByText(/Müşteri onay kaydı:/).waitFor();
    await panel
      .getByLabel("Teslim alma fotoğrafları ekle", { exact: true })
      .setInputFiles({
        name: "received.png",
        mimeType: "image/png",
        buffer: png,
      });
    await panel
      .getByText("Özel fotoğraflar kaydedildi.", { exact: true })
      .waitFor();
    const saved = await (
      await admin.request.get(origin + "/api/admin/requests?id=" + custom.id)
    ).json();
    assert.equal(saved.files.length, 3);
    assert(saved.history.some((e) => e.type === "files"));
    assert(
      saved.history.some((e) => e.type === "operations" && e.detail.after),
    );
    assert(saved.record.quotes[0].accepted_at);
    assert.equal(saved.record.operations.terms_snapshot.version, 1);
    const conflict = await admin.request.post(origin + "/api/admin/requests", {
      data: {
        id: custom.id,
        expectedRevision: 1,
        action: { type: "status", status: "review", note: "Stale" },
      },
    });
    assert.equal(conflict.status(), 409);
    await panel
      .getByRole("button", { name: "Tüm talepler", exact: true })
      .click();
    await panel
      .getByRole("button", { name: "İş analitiği", exact: true })
      .click();
    await panel
      .getByRole("heading", {
        name: "En çok talep edilen modeller",
        exact: true,
      })
      .waitFor();
    await panel
      .getByRole("button", { name: "Müşteriler", exact: true })
      .click();
    assert((await panel.locator(".crm-customer-grid .crm-card").count()) >= 2);
    await panel.setViewportSize({ width: 390, height: 844 });
    await panel.screenshot({
      path: "/tmp/kuzmin-requests-crm-mobile.png",
      fullPage: true,
    });
    await admin.close();
  } else {
    // Empty motorcycle inventories still offer both services and prefill the exact selection.
    await page
      .getByRole("button", { name: "Veri paneli", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Talepler & CRM", exact: true })
      .click();
    await page
      .getByRole("button", { name: "İş analitiği", exact: true })
      .click();
    await page
      .getByRole("heading", {
        name: "En çok talep edilen modeller",
        exact: true,
      })
      .waitFor();
    await page.getByRole("button", { name: "Başvurular", exact: true }).click();
    await page
      .locator("tbody tr")
      .filter({ hasText: "Örnek özel karbon kaplama" })
      .getByRole("button", { name: /Talebi aç/ })
      .click();
    await page
      .getByLabel("Talep aşaması", { exact: true })
      .selectOption("review");
    await page
      .getByLabel("Durum değişikliği açıklaması", { exact: true })
      .fill("Örnek teknik değerlendirme");
    await page
      .getByRole("button", { name: "Aşamayı kaydet", exact: true })
      .click();
    await page.getByText(/Talep güncellendi/).waitFor();
    await page.evaluate((key) => {
      const c = JSON.parse(localStorage.getItem(key)) || null;
      if (c) {
        c.compatibility = c.compatibility.filter(
          (f) => f.model_id !== "yamaha-mt-25",
        );
        localStorage.setItem(key, JSON.stringify(c));
      }
    }, key);
    // The initial catalog need not be persisted yet; obtain it from the iframe before editing.
    await page
      .getByRole("button", { name: "Sayfa önizlemeleri", exact: true })
      .click();
    await page.locator("#site-page").selectOption("fitment");
    await frame().locator(".request-options").waitFor();
    const c = await page
      .locator("#site-frame")
      .evaluate((f) => f.contentWindow.__KZ_SITE__.catalog);
    c.compatibility = c.compatibility.filter(
      (f) => f.model_id !== "yamaha-mt-25",
    );
    await page.evaluate(
      ({ key, c }) => localStorage.setItem(key, JSON.stringify(c)),
      { key, c },
    );
    await page.reload();
    await page.locator("#site-page").selectOption("fitment");
    await frame()
      .getByRole("heading", {
        name: "Bu motosiklet için henüz satışta ürünümüz bulunmuyor.",
        exact: true,
      })
      .waitFor();
    assert.equal(
      await frame().locator(".request-option-grid article").count(),
      2,
    );
    await page.locator("#site-inspect").uncheck();
    await frame()
      .getByRole("link", { name: /Özel üretim talebi/ })
      .click();
    await frame().locator(".custom-hero").waitFor();
    await page.screenshot({
      path: "/tmp/kuzmin-custom-carbon-preview.png",
      fullPage: true,
    });
    await page.locator('[data-action="site-device"][data-id="mobile"]').click();
    await frame()
      .getByLabel("Ad soyad", { exact: true })
      .scrollIntoViewIfNeeded();
    assert(
      await page
        .locator("#site-frame")
        .evaluate(
          (f) =>
            f.contentDocument.documentElement.scrollWidth <=
            f.contentWindow.innerWidth + 1,
        ),
    );
    await page.screenshot({
      path: "/tmp/kuzmin-custom-carbon-mobile.png",
      fullPage: true,
    });
  }
  assert.deepEqual(errors, []);
  console.log(
    `PASS (${app ? "production app" : "browser preview"}): guest enquiries, context transfer, CRM/quotes/history, privacy, safe preview, permanent request options and responsive forms.`,
  );
} finally {
  await browser.close();
  if (app) await server.stop();
  else {
    server.closeAllConnections();
    await new Promise((r) => server.close(r));
  }
}
