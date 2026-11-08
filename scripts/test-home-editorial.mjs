import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { testAppServer } from "./test-app-server.mjs";
import { dismissCookies } from "./test-cookie-helper.mjs";
const app = process.argv.includes("--app"),
  key = "kuzmin.workspace.gsgvhlcglf-blip.dassda.v1";
const source = readFileSync("docs/panel.html", "utf8"),
  initial = JSON.parse(source.match(/const INITIAL = (\{[^\n]*\});/)[1]),
  products = initial.products,
  posts = initial.content.filter((r) => r.key.startsWith("blog-"));
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
try {
  const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    }),
    page = await context.newPage(),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(origin + (app ? "/" : "/docs/panel.html"));
  const view = () => (app ? page : page.frameLocator("#site-frame"));
  await expect(view().locator(".cookie-notice")).toBeVisible();
  await dismissCookies(view());
  if (!app) await page.locator("#site-inspect").uncheck();
  await expect(view().locator(".bestseller-card")).toHaveCount(3);
  const layout = await view()
    .locator(".home-bestsellers")
    .evaluate((el) => ({
      top: el.getBoundingClientRect().top,
      bottom: el.getBoundingClientRect().bottom,
      brands: document.querySelector(".home-brands").getBoundingClientRect()
        .bottom,
      quote: document.querySelector(".home-custom").getBoundingClientRect().top,
      card: el.querySelector(".bestseller-card").getBoundingClientRect().width,
      rail: el.querySelector(".bestsellers-rail").clientWidth,
    }));
  assert(layout.top >= layout.brands && layout.bottom <= layout.quote);
  assert(Math.abs(layout.card * 3 + 48 - layout.rail) < 3);
  if (app) {
    await page.goto(origin + "/admin");
    await page.getByLabel("Şifre", { exact: true }).fill(server.password);
    await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
    await page
      .getByRole("heading", { name: "Genel bakış", exact: true })
      .waitFor();
  } else
    await page
      .getByRole("button", { name: "Veri paneli", exact: true })
      .click();
  await page
    .getByRole("button", { name: "En çok satanlar", exact: true })
    .click();
  await page
    .getByRole("checkbox", {
      name: "Vitrine ekle: " + products[3].title.tr,
      exact: true,
    })
    .check();
  await page
    .getByLabel("Karusel geçiş süresi", { exact: true })
    .selectOption("3");
  await page.getByLabel("Vitrin ölçek", { exact: true }).focus();
  await page.getByLabel("Vitrin ölçek", { exact: true }).press("End");
  await page
    .getByRole("button", { name: "Vitrini kaydet", exact: true })
    .click();
  if (app) {
    await page.waitForFunction(() => !document.querySelector(".loading"));
    let data = await (await context.request.get(origin + "/api/admin")).json();
    const config = data.content.find((r) => r.key === "home-bestsellers");
    assert.equal(JSON.parse(config.body.tr).productIds.length, 4);
    assert.equal(JSON.parse(config.body.tr).frames[products[0].id].scale, 200);
    const response = await context.request.post(origin + "/api/admin/studio", {
      data: {
        action: "publish",
        expectedRevision: data._workspace[0].revision,
      },
    });
    assert(response.ok(), await response.text());
    await page.goto(origin);
  } else {
    await page
      .getByRole("button", { name: "Sayfa önizlemeleri", exact: true })
      .click();
    await page.locator("#site-page").selectOption("home");
    await page.locator("#site-inspect").uncheck();
  }
  await dismissCookies(view());
  await expect(view().locator(".bestseller-card")).toHaveCount(4);
  await page.mouse.move(0, 0);
  await expect
    .poll(
      () =>
        view()
          .locator(".bestsellers-rail")
          .evaluate((el) => el.scrollLeft),
      { timeout: 7000 },
    )
    .toBeGreaterThan(100);
  await page.waitForTimeout(700);
  await view().locator(".home-bestsellers").hover();
  const left = await view()
    .locator(".bestsellers-rail")
    .evaluate((el) => el.scrollLeft);
  await page.waitForTimeout(3300);
  assert(
    Math.abs(
      (await view()
        .locator(".bestsellers-rail")
        .evaluate((el) => el.scrollLeft)) - left,
    ) < 2,
  );
  if (!app) {
    await page.locator("#site-inspect").check();
    await view().locator(".bestseller-image-binding").first().click();
    await page.locator("#bestseller-frame-scale").waitFor();
    await page.locator("#bestseller-frame-scale").evaluate((el) => {
      el.value = "175";
      el.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const config = await page.evaluate(
      (key) =>
        JSON.parse(
          JSON.parse(localStorage.getItem(key)).content.find(
            (r) => r.key === "home-bestsellers",
          ).body.tr,
        ),
      key,
    );
    assert.equal(config.frames[products[0].id].scale, 175);
    await page.getByLabel("Hizalama kılavuzu", { exact: true }).uncheck();
    await expect(view().locator(".bestseller-guides").first()).toBeHidden();
    await page.locator("#site-inspect").uncheck();
  }
  await page.screenshot({
    path: "/tmp/editorial-home-" + (app ? "app" : "preview") + ".png",
    fullPage: true,
  });
  await view().locator('.primary-nav a[href="/hakkimizda"]').click();
  await expect(view().locator(".about-brand")).toBeVisible();
  assert(
    !/ducati|bmw|yamaha/i.test(
      await view().locator(".content-body").innerText(),
    ),
  );
  const about = await view().locator(".about-brand .wordmark").boundingBox(),
    body = await view().locator(".content-body").boundingBox();
  assert(about.x + about.width < body.x);
  await expect(view().locator(".about-page > .text-link")).toHaveAttribute(
    "href",
    "/parcani-urettir",
  );
  await page.screenshot({
    path: "/tmp/editorial-about-" + (app ? "app" : "preview") + ".png",
    fullPage: true,
  });
  await view().locator('.primary-nav a[href="/blog"]').click();
  await expect(view().locator(".blog-card")).toHaveCount(3);
  await expect(view().locator(".blog-card img")).toHaveCount(3);
  for (const post of posts) {
    await view()
      .locator(`a.blog-card[href*="${post.key.slice(5)}"]`)
      .click();
    await expect(view().locator(".blog-article h1")).toHaveText(post.title.tr);
    assert((await view().locator(".content-body h2").count()) >= 4);
    assert((await view().locator(".blog-figures img").count()) >= 1);
    if (app) {
      await expect(page).toHaveTitle(
        new RegExp(post.title.tr.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
      );
      assert(
        (await page.locator('meta[name="description"]').getAttribute("content"))
          .length > 80,
      );
    }
    await view().locator(".blog-article > .text-link").first().click();
  }
  if (app) await page.setViewportSize({ width: 390, height: 844 });
  else await page.getByRole("button", { name: "Mobil", exact: true }).click();
  await dismissCookies(view());
  assert(
    await view()
      .locator("html")
      .evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  );
  await page.screenshot({
    path: "/tmp/editorial-mobile-" + (app ? "app" : "preview") + ".png",
    fullPage: true,
  });
  await page.reload();
  await expect(view().locator(".cookie-notice")).toBeVisible();
  await view().getByRole("button", { name: "Kabul et", exact: true }).click();
  await expect(view().locator(".cookie-notice")).toHaveCount(0);
  await page.reload();
  await expect(view().locator(".cookie-notice")).toBeVisible();
  assert.equal(
    await view()
      .locator("html")
      .evaluate(() => sessionStorage.getItem("kz.analytics.tab")),
    null,
  );
  assert.deepEqual(errors, []);
  console.log(
    `PASS (${app ? "app" : "preview"}): curated bestseller panel, three-card layout, timed carousel/hover pause, framing, broad about/logo, three illustrated SEO articles, tidy footer and fresh consent on every reload.`,
  );
} finally {
  await browser.close();
  if (app) await server.stop();
  else {
    server.closeAllConnections();
    await new Promise((r) => server.close(r));
  }
}
