import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
const key = "kuzmin.workspace.gsgvhlcglf-blip.dassda.v1";
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage(),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  if (process.env.TEST_PROVIDER) {
    const loader = `<html><body><script>(async()=>{const html=await(await fetch(location.search.slice(1))).text();const doc=new DOMParser().parseFromString(html,'text/html');const scripts=[...doc.scripts].map(s=>s.textContent);doc.querySelectorAll('script').forEach(s=>s.remove());document.open();document.write(doc.documentElement.outerHTML);document.close();for(const text of scripts){const script=document.createElement('script');script.textContent=text;document.body.appendChild(script);}})()</script></body></html>`;
    await context.route("https://htmlpreview.github.io/**", (route) =>
      route.fulfill({ contentType: "text/html", body: loader }),
    );
    await context.route("https://raw.githubusercontent.com/**", (route) => {
      const name = route.request().url().includes("panel-version.json")
        ? "panel-version.json"
        : route.request().url().includes("store.html")
          ? "store.html"
          : "panel.html";
      return route.fulfill({
        contentType: name.endsWith("json") ? "application/json" : "text/plain",
        headers: { "Access-Control-Allow-Origin": "*" },
        body: readFileSync("docs/" + name, "utf8"),
      });
    });
  }
  await page.goto(
    process.env.TEST_PROVIDER
      ? "https://htmlpreview.github.io/?https://raw.githubusercontent.com/gsgvhlcglf-blip/dassda/main/docs/panel.html"
      : "http://localhost:4173/docs/panel.html",
  );
  const frame = () => page.frameLocator("#site-frame");
  await frame().locator(".hero h1").waitFor();
  assert.equal(await page.locator("#site-inspect").isChecked(), true);
  await frame().locator(".hero h1").click();
  await page.getByLabel("Seçili metni düzenle").fill("Yeni başlık <örnek>");
  await page.waitForFunction(
    () =>
      document
        .querySelector("#site-frame")
        .contentDocument.querySelector(".hero h1").textContent ===
      "Yeni başlık <örnek>",
  );
  // Direct inline editing is persisted, including characters that must remain plain text.
  await frame().locator(".hero h1").click();
  await frame().locator(".hero h1").fill("Doğrudan yazılan başlık");
  await page.getByLabel("Seçili metni düzenle").click();
  await page.waitForFunction(
    (key) =>
      JSON.parse(localStorage.getItem(key)).content.find((c) => c.id === "home")
        .title.tr === "Doğrudan yazılan başlık",
    key,
  );
  await frame().locator(".hero .button").click();
  await page.waitForFunction(
    () =>
      document
        .querySelector(".site-direct-editor")
        ?.getAttribute("data-edit-key") === "ui:explore",
  );
  await page.getByLabel("Seçili metni düzenle").fill("Motosikletimi seç");
  await frame()
    .locator(".hero .button")
    .filter({ hasText: "Motosikletimi seç" })
    .waitFor();
  await frame()
    .locator(".hero img")
    .click({ position: { x: 1000, y: 100 } });
  await page.locator("#site-photo").setInputFiles("public/images/hero.webp");
  await page.waitForFunction(
    (key) =>
      Boolean(
        JSON.parse(localStorage.getItem(key + ".design"))?.images["home.hero"],
      ),
    key,
  );
  const image = await frame().locator(".hero img").getAttribute("src");
  assert.ok(image.startsWith("data:image/webp"));
  await page.reload();
  await frame().locator(".hero h1").waitFor();
  assert.equal(
    await frame().locator(".hero h1").innerText(),
    "Doğrudan yazılan başlık",
  );
  assert.equal(await frame().locator(".hero img").getAttribute("src"), image);
  const popupPromise = context.waitForEvent("page");
  await page.getByRole("button", { name: "Müşteri önizlemesi ↗" }).click();
  const customer = await popupPromise;
  customer.on("pageerror", (e) => errors.push(e.message));
  await customer.locator(".hero h1").waitFor();
  assert.equal(
    await customer.locator(".hero h1").innerText(),
    "Doğrudan yazılan başlık",
  );
  assert.equal(await customer.locator("#site-inspector").count(), 0);
  assert.equal(await customer.locator("[contenteditable]").count(), 0);
  await frame().locator(".hero h1").click();
  await page.getByLabel("Seçili metni düzenle").fill("İki sekmede aynı sonuç");
  await customer
    .getByRole("heading", { name: "İki sekmede aynı sonuç", exact: true })
    .waitFor();
  assert.equal(await frame().locator("#main > section").count(), 2);
  assert.equal(await frame().locator(".home-photo-slot").count(), 4);
  assert.equal(
    await frame()
      .locator(
        ".hero-bottom,.hero-side,.hero-content p,.editorial-section,.bike-section,.featured-section,.craft-section",
      )
      .count(),
    0,
  );
  // Legacy photo slots remain usable; new slots save independently and sync to the customer tab.
  for (const slot of ["home.editorial.bike", "home.editorial.weave"]) {
    await frame()
      .locator('.home-photo-slot[data-visual-image="' + slot + '"]')
      .click();
    await page.waitForFunction(
      (slot) =>
        document
          .querySelector("#site-photo")
          ?.getAttribute("data-image-key") === slot,
      slot,
    );
    await page.locator("#site-photo").setInputFiles("public/images/hero.webp");
    await page.waitForFunction(
      ({ key, slot }) =>
        !!JSON.parse(localStorage.getItem(key + ".design"))?.images[slot],
      { key, slot },
    );
    await customer
      .locator('.home-photo-slot[data-visual-image="' + slot + '"] img')
      .waitFor();
  }
  const gallery = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key + ".design")).images,
    key,
  );
  assert.equal(gallery["home.hero"], image);
  await page.reload();
  await frame()
    .locator('.home-photo-slot[data-visual-image="home.editorial.weave"] img')
    .waitFor();
  assert.equal(
    await frame()
      .locator('.home-photo-slot[data-visual-image="home.editorial.bike"] img')
      .getAttribute("src"),
    gallery["home.editorial.bike"],
  );
  assert.equal(
    await frame()
      .locator('.home-photo-slot[data-visual-image="home.editorial.weave"] img')
      .getAttribute("src"),
    gallery["home.editorial.weave"],
  );
  assert.equal(await customer.locator(".home-photo-slot img").count(), 4);
  await customer
    .locator(".home-photo-grid")
    .screenshot({ path: "/tmp/home-photo-mosaic-desktop.png" });
  await customer.setViewportSize({ width: 390, height: 844 });
  assert(
    await customer.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await customer
    .locator(".home-photo-grid")
    .screenshot({ path: "/tmp/home-photo-mosaic-mobile.png" });
  await customer.setViewportSize({ width: 1440, height: 1000 });
  await customer.locator(".hero .button").click();
  await customer.locator(".brand-card").filter({ hasText: "YAMAHA" }).click();
  await customer.locator(".model-card").filter({ hasText: "MT-25" }).click();
  await customer.getByRole("link", { name: "2024", exact: true }).click();
  await customer.locator(".product-card").first().click();
  await customer
    .getByRole("button", { name: "Sepete ekle", exact: true })
    .click();
  await customer.locator(".bag-link").click();
  await customer.locator(".cart-line").first().waitFor();
  await customer.reload();
  await customer.locator(".cart-line").first().waitFor();
  assert.ok(customer.url().endsWith("#/sepet"));
  await customer.goBack();
  await customer.locator(".product-detail").waitFor();
  await customer.goForward();
  await customer.locator(".cart-line").first().waitFor();
  await page.locator("#site-page").selectOption("models");
  await frame().locator(".model-card img").first().click();
  await page.locator("#site-photo").setInputFiles("public/images/hero.webp");
  await page.waitForFunction(
    (key) =>
      JSON.parse(localStorage.getItem(key)).models.some((m) =>
        m.image.startsWith("data:image/webp"),
      ),
    key,
  );
  await page.locator("#site-page").selectOption("product");
  await frame().locator(".product-copy h1").click();
  await page.getByLabel("Seçili metni düzenle").fill("Özel ürün adı");
  await frame()
    .locator(".product-copy h1")
    .filter({ hasText: "Özel ürün adı" })
    .waitFor();
  await frame().locator(".detail-main-image img").click();
  await page.locator("#site-photo").setInputFiles("public/images/hero.webp");
  await page.waitForFunction(
    (key) =>
      JSON.parse(localStorage.getItem(key)).product_images.some((m) =>
        m.url.startsWith("data:image/webp"),
      ),
    key,
  );
  assert.deepEqual(errors, []);
  await page.screenshot({ path: "/tmp/direct-editor.png", fullPage: true });
  console.log(
    "PASS: minimal homepage, photo mosaic uploads/legacy slots/reload/customer sync, direct editing, customer journey and cart persistence.",
  );
} finally {
  await browser.close();
}
