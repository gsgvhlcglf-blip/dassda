import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { join } from "node:path";
import { testAppServer } from "./test-app-server.mjs";
const server = await testAppServer(),
  browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
try {
  const { origin, password } = server,
    admin = await browser.newContext(),
    page = await admin.newPage(),
    publicContext = await browser.newContext(),
    shop = await publicContext.newPage(),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  shop.on("pageerror", (e) => errors.push(e.message));
  assert.equal(
    (await publicContext.request.get(origin + "/api/admin/studio")).status(),
    401,
  );
  const denied = await publicContext.request.get(origin + "/taslak-onizleme");
  assert(!(await denied.text()).includes('class="hero"'));
  await page.goto(origin + "/admin");
  await page.getByLabel("Şifre", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
  await page
    .getByRole("heading", { name: "Genel bakış", exact: true })
    .waitFor();
  const workspace = async () =>
    await (await admin.request.get(origin + "/api/admin/studio")).json();
  let before = await workspace();
  const original = before.snapshot.catalog.content.find(
    (c) => c.key === "home",
  );
  let response = await admin.request.post(origin + "/api/admin", {
    data: {
      table: "content",
      action: "update",
      expectedRevision: before.revision,
      record: {
        ...original,
        title: { ...original.title, tr: "Reviewed studio draft" },
      },
    },
  });
  assert(response.ok(), await response.text());
  await shop.goto(origin);
  assert.notEqual(
    await shop.locator(".hero h1").innerText(),
    "Reviewed studio draft",
  );
  await page
    .getByRole("button", { name: "Yayın & sürümler", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Taslağı yayınla", exact: true })
    .click();
  await page.getByText("Şu an yayında", { exact: false }).first().waitFor();
  await shop.reload();
  assert.equal(
    await shop.locator(".hero h1").innerText(),
    "Reviewed studio draft",
  );
  let published = await workspace();
  const baseline = published.history.find(
    (v) => v.label === "İlk yayın öncesi",
  );
  assert(baseline);
  response = await admin.request.post(origin + "/api/admin/studio", {
    data: { action: "publish", expectedRevision: before.revision },
  });
  assert.equal(response.status(), 409);
  const db = new DatabaseSync(join(server.directory, ".data/store.sqlite"));
  db.prepare("UPDATE products SET stock=3 WHERE id='p1'").run();
  response = await admin.request.post(origin + "/api/admin/studio", {
    data: {
      action: "restore",
      expectedRevision: published.revision,
      versionId: baseline.id,
    },
  });
  assert(response.ok(), await response.text());
  assert.equal(
    db.prepare("SELECT stock FROM products WHERE id='p1'").get().stock,
    3,
  );
  db.close();
  await shop.reload();
  assert.equal(await shop.locator(".hero h1").innerText(), original.title.tr);
  await page
    .getByRole("button", { name: "Fotoğraf düzeni", exact: true })
    .click();
  await page.getByLabel("Fotoğraf kadrajı").selectOption("portrait");
  await page.getByLabel("Fotoğraf arka planı").selectOption("light");
  const savedPhoto = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/admin/studio") && r.request().method() === "POST",
  );
  await page
    .getByRole("button", {
      name: "Fotoğraf düzenini taslağa kaydet",
      exact: true,
    })
    .click();
  assert((await savedPhoto).ok(), await (await savedPhoto).text());
  await page.getByLabel("Fotoğraf kadrajı").waitFor();
  await shop.goto(origin + "/urunler");
  assert.equal(
    await shop
      .locator(".product-visual")
      .first()
      .evaluate((el) => getComputedStyle(el).aspectRatio),
    "1 / 1",
  );
  let photos = await workspace();
  assert.equal(photos.snapshot.design.photography.aspect, "portrait");
  await admin.request.post(origin + "/api/admin/studio", {
    data: { action: "publish", expectedRevision: photos.revision },
  });
  await shop.reload();
  assert.equal(
    await shop
      .locator(".product-visual")
      .first()
      .evaluate((el) => getComputedStyle(el).aspectRatio),
    "4 / 5",
  );
  await admin.request.post(origin + "/api/admin/analytics", {
    data: { action: "settings", enabled: true, retentionDays: 30 },
  });
  await shop.goto(origin + "/motosikletler");
  await shop.getByRole("button", { name: "İzin ver", exact: true }).click();
  await shop.locator(".brand-card").filter({ hasText: "YAMAHA" }).click();
  await shop.locator(".model-card").filter({ hasText: "MT-25" }).click();
  await shop.getByRole("link", { name: "2024", exact: true }).click();
  await shop.locator(".product-card").first().click();
  await shop.getByRole("button", { name: "Sepete ekle", exact: true }).click();
  await shop.waitForTimeout(5400);
  const report = await (
    await admin.request.get(origin + "/api/admin/analytics?days=7")
  ).json();
  assert.deepEqual(report.report.funnel.counts, [1, 1, 1, 1, 1, 1]);
  assert.deepEqual(errors, []);
  console.log(
    "App studio passed: protected draft APIs, publication/rollback, optimistic conflicts, retained stock, unpublished photo isolation, published photo settings and ordered shopping funnel.",
  );
} finally {
  await browser.close();
  await server.stop();
}
