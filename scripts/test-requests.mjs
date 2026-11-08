import { dismissCookies } from "./test-cookie-helper.mjs";
import { chromium, expect } from "@playwright/test";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
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
  await dismissCookies(frame());
  await frame()
    .getByRole("combobox", { name: "Koleksiyon", exact: true })
    .selectOption("body");
  await frame()
    .getByRole("link", { name: /Talep oluştur/ })
    .click();
  await expect(frame().getByLabel("Marka", { exact: true })).toHaveValue(
    "YAMAHA",
  );
  await expect(frame().getByLabel("Model", { exact: true })).toHaveValue(
    "MT-25",
  );
  await expect(frame().getByLabel("Yıl", { exact: true })).toHaveValue("2024");
  // The new quote button carries the selected bike; legacy demand requests remain supported.
  if (app) {
    const demandURL = new URL(page.url());
    demandURL.searchParams.set("type", "demand");
    await page.goto(demandURL.href);
  }
  assert.equal(await frame().locator(".request-form select").count(), 0);
  assert.equal(await frame().locator(".request-form textarea").count(), 1);
  assert.equal(await frame().getByRole("radio").count(), 4);
  assert.equal(
    await frame().locator(".request-method-fieldset img").count(),
    0,
  );
  await frame()
    .getByRole("radio", { name: "Forged Carbon", exact: true })
    .check();
  await frame()
    .getByRole("radio", { name: "Twill Carbon", exact: true })
    .check();
  await expect(
    frame().getByRole("radio", { name: "Forged Carbon", exact: true }),
  ).not.toBeChecked();
  async function fillForm(view, kind, email) {
    await view
      .getByRole("radio", {
        name: kind === "demand" ? "Twill Carbon" : "Forged Carbon",
        exact: true,
      })
      .check();
    await view
      .getByRole("radio", {
        name:
          kind === "demand"
            ? "İnfüzyon (Kalıptan yeni parça üretimi)"
            : "Laminasyon (Mevcut parça üzerine kaplama)",
        exact: true,
      })
      .check();
    await view
      .getByLabel("Açıklama", { exact: true })
      .fill(
        kind === "demand" ? "Test talep paneli" : "Test özel üretim paneli",
      );
    await view.getByLabel("Parça uzunluğu (cm)", { exact: true }).fill("25.5");
    await view.getByLabel("Parça genişliği (cm)", { exact: true }).fill("12.5");
    await view
      .getByLabel("Adınız", { exact: true })
      .fill("Test request customer");
    await view
      .getByLabel("Cep telefonu", { exact: true })
      .fill("+905550001122");
    await view.getByLabel("E-posta", { exact: true }).fill(email);
    await expect(
      view.getByLabel("Cep telefonu", { exact: true }),
    ).toHaveAttribute("required", "");
    await expect(view.getByLabel("E-posta", { exact: true })).toHaveAttribute(
      "required",
      "",
    );
    await view.locator('input[name="permission"]').check();
  }
  const photo = (name) => ({ name, mimeType: "image/png", buffer: png });
  await fillForm(frame(), "demand", "requests-browser@example.test");
  await frame()
    .getByLabel("Fotoğraflar (en az 3)", { exact: true })
    .setInputFiles([photo("one.png"), photo("two.png")]);
  await frame()
    .getByRole("button", { name: "Talebini gönder", exact: true })
    .click();
  await frame()
    .getByRole("alert")
    .filter({ hasText: /En az 3 fotoğraf/ })
    .waitFor();
  await frame()
    .getByLabel("Fotoğraflar (en az 3)", { exact: true })
    .setInputFiles(photo("three.png"));
  let demandRef, customRef;
  if (app) {
    await page
      .getByRole("button", { name: "Talebini gönder", exact: true })
      .click();
    await page.getByText(/KZ-UT-/).waitFor();
    demandRef = await page.locator(".request-thanks strong").innerText();
  } else {
    const calls = [];
    page.on("request", (r) => {
      if (r.url().includes("/api/requests")) calls.push(r.url());
    });
    await frame()
      .getByRole("button", { name: "Talebini gönder", exact: true })
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
    await page.getByLabel("Marka", { exact: true }).fill("Honda");
    await page.getByLabel("Model", { exact: true }).fill("CBR650R");
    await page.getByLabel("Yıl", { exact: true }).fill("2018");
    await page
      .getByLabel("Fotoğraflar (en az 3)", { exact: true })
      .setInputFiles([photo("one.png"), photo("two.png"), photo("three.png")]);
    await page
      .getByRole("button", { name: "Talebini gönder", exact: true })
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
    assert.equal(custom.snapshot.brand, "Honda");
    assert.equal(custom.snapshot.model, "CBR650R");
    assert.equal(custom.input.model_id, "");
    assert.equal(custom.input.length_cm, 25.5);
    assert.equal(custom.input.width_cm, 12.5);
    assert.equal(demand.input.material, "twill");
    assert.equal(demand.input.manufacturing_method, "infusion");
    assert.equal(custom.input.material, "forged");
    assert.equal(custom.input.manufacturing_method, "lamination");
    assert.equal(custom.input.phone, "+905550001122");
    assert.equal(custom.input.email, "custom-browser@example.test");
    const detail = await (
      await admin.request.get(origin + "/api/admin/requests?id=" + custom.id)
    ).json();
    assert.equal(detail.files.length, 3);
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
    const multipart = (value = payload, count = 3, bad = false) => {
      const f = new FormData();
      f.set("payload", JSON.stringify(value));
      for (let i = 0; i < count; i++)
        f.append(
          "photos",
          new File(
            [
              bad && i === 0
                ? Buffer.from(
                    '<svg xmlns="http://www.w3.org/2000/svg">unsafe</svg>',
                  )
                : png,
            ],
            bad && i === 0 ? "unsafe.svg" : "p" + i + ".png",
            { type: bad && i === 0 ? "image/svg+xml" : "image/png" },
          ),
        );
      return f;
    };
    const one = await context.request.post(origin + "/api/requests", {
        multipart: multipart(),
      }),
      two = await context.request.post(origin + "/api/requests", {
        multipart: multipart(),
      });
    assert.equal(one.status(), 201, await one.text());
    // The panel was already open when the third enquiry was submitted.
    const freshReference = (await one.json()).reference;
    await panel.evaluate(() => window.dispatchEvent(new Event("focus")));
    await panel.getByText(freshReference, { exact: false }).waitFor();
    const analytics = await (
      await admin.request.get(
        origin + "/api/admin/requests?view=insights&days=30",
      )
    ).json();
    assert.equal(analytics.insights.total, 3);
    assert.equal(
      analytics.insights.byMaterial.find((v) => v.name === "Twill Carbon")
        .count,
      2,
    );
    assert.equal(
      analytics.insights.byMethod.find((v) => v.name.startsWith("İnfüzyon"))
        .count,
      2,
    );
    assert(!JSON.stringify(analytics).includes("custom-browser@example.test"));
    assert.equal(
      (
        await context.request.get(origin + "/api/admin/requests?view=insights")
      ).status(),
      401,
    );
    assert.equal((await one.json()).reference, (await two.json()).reference);
    const invalid = await context.request.post(origin + "/api/requests", {
      multipart: multipart(
        { ...payload, submission_key: crypto.randomUUID() },
        3,
        true,
      ),
    });
    assert.equal(invalid.status(), 400);
    const tooFew = await context.request.post(origin + "/api/requests", {
      multipart: multipart(
        { ...payload, submission_key: crypto.randomUUID() },
        2,
      ),
    });
    assert.equal(tooFew.status(), 400);
    const noMeasure = await context.request.post(origin + "/api/requests", {
      multipart: multipart({
        ...payload,
        submission_key: crypto.randomUUID(),
        length_cm: 0,
      }),
    });
    assert.equal(noMeasure.status(), 400);
    // A database failure must roll back record/history/files and never return success.
    const db = new DatabaseSync(server.directory + "/.data/store.sqlite");
    const photoCount = () =>
      readdirSync(server.directory + "/.data/request-files", {
        recursive: true,
      }).filter((p) => /\.(png|jpg|webp)$/.test(String(p))).length;
    const countBeforeFailure = photoCount();
    db.exec(
      "CREATE TRIGGER test_request_failure BEFORE INSERT ON work_request_files BEGIN SELECT RAISE(ABORT, 'TEST_CRM_WRITE_FAILED'); END;",
    );
    try {
      const failed = await context.request.post(origin + "/api/requests", {
        multipart: multipart({
          ...payload,
          submission_key: crypto.randomUUID(),
          email: "rollback@example.test",
          phone: "+905551234567",
        }),
      });
      assert.equal(failed.status(), 400);
      assert.equal(
        db.prepare("SELECT count(*) n FROM work_requests").get().n,
        3,
      );
      assert.equal(photoCount(), countBeforeFailure);
    } finally {
      db.exec("DROP TRIGGER test_request_failure");
      db.close();
    }
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
    assert.equal(saved.files.length, 4);
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
    await expect(
      panel.locator("[data-request-insights] .crm-stats > div").first(),
    ).toContainText("3");
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
    await panel.setViewportSize({ width: 1440, height: 1000 });
    await panel
      .getByRole("button", { name: "Analitik & Isı Haritası", exact: true })
      .click();
    await expect(
      panel.locator("[data-crm-analytics] .crm-stats > div").first(),
    ).toContainText("3");
    await admin.request.post(origin + "/api/admin/analytics", {
      data: { action: "clear" },
    });
    await panel
      .getByRole("button", { name: "Talep verisini yenile", exact: true })
      .click();
    await expect(
      panel.locator("[data-crm-analytics] .crm-stats > div").first(),
    ).toContainText("3");
    await panel.screenshot({
      path: "/tmp/kuzmin-request-analytics.png",
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
    await page
      .getByRole("button", { name: "Analitik & Isı Haritası", exact: true })
      .click();
    const analyticsFrame = page.frameLocator("#analytics-panel-frame");
    try {
      await expect(
        analyticsFrame.locator("[data-crm-analytics] .crm-stats > div").first(),
      ).toContainText("2");
    } catch (e) {
      console.error("Analytics frame errors:", errors);
      throw e;
    }
    await expect(analyticsFrame.locator("[data-crm-analytics]")).toContainText(
      "Örnek CRM başvuruları",
    );
    await page
      .getByRole("button", { name: "Talepler & CRM", exact: true })
      .click();
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
    await frame().locator(".quote-request-empty").waitFor();
    assert.equal(await frame().locator(".quote-request .button").count(), 1);
    assert.equal(await frame().locator(".catalog-tools").count(), 0);
    await page.locator("#site-inspect").uncheck();
    await frame()
      .getByRole("link", { name: /Talep oluştur/ })
      .click();
    await frame().locator(".custom-simple-page").waitFor();
    await frame()
      .locator(".request-image-fieldset")
      .first()
      .screenshot({ path: "/tmp/kuzmin-carbon-choices.png" });
    await frame()
      .locator(".request-image-fieldset")
      .last()
      .screenshot({ path: "/tmp/kuzmin-method-choices.png" });
    await page.screenshot({
      path: "/tmp/kuzmin-custom-carbon-preview.png",
      fullPage: true,
    });
    await page.locator("#site-inspect").check();
    await frame()
      .locator('[data-visual-image="requests.material.forged"]')
      .click();
    await page
      .getByLabel("Yeni fotoğraf seç", { exact: true })
      .setInputFiles("public/images/hero.webp");
    await page.waitForFunction(
      (key) =>
        !!JSON.parse(localStorage.getItem(key + ".design"))?.images[
          "requests.material.forged"
        ],
      key,
    );
    await page.locator("#site-inspect").uncheck();
    await page.locator('[data-action="site-device"][data-id="mobile"]').click();
    await frame()
      .getByLabel("Adınız", { exact: true })
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
