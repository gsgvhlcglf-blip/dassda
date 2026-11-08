import { dismissCookies } from "./test-cookie-helper.mjs";
import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { testAppServer } from "./test-app-server.mjs";
const app = process.argv.includes("--app"),
  key = "kuzmin.workspace.gsgvhlcglf-blip.dassda.v1";
const image =
  "data:image/webp;base64," +
  readFileSync("public/images/hero.webp").toString("base64");
const posts = Array.from({ length: 12 }, (_, i) => {
  const names = [
    "Karbonun dokusu",
    "Forged Carbon ve Twill Carbon arasında görsel bir yolculuk",
    "İki teker üzerinde tasarım",
    "Motosikletinde kişisel bir dokunuş",
    "Uzun bir başlığın da rahatça okunabildiği, görselin içinde nefes alan ve kesilmeden gösterilen konu banneri",
  ];
  return {
    id: "banner-test-" + i,
    key: "blog-banner-test-" + i,
    title: {
      tr: "Örnek: " + names[i % names.length] + " " + (i + 1),
      en: "",
      ru: "",
    },
    body: {
      tr: "Bu metin yalnızca otomatik test verisidir. Gerçek yayın değildir.",
      en: "",
      ru: "",
    },
  };
});
let server, origin;
if (app) {
  server = await testAppServer();
  origin = server.origin;
} else {
  server = createServer((req, res) => {
    const path = new URL(req.url, "http://localhost").pathname;
    if (!/^\/docs\/(panel\.html|store\.html|panel-version\.json)$/.test(path))
      return res.writeHead(404).end();
    res.setHeader(
      "Content-Type",
      path.endsWith("json") ? "application/json" : "text/html; charset=utf-8",
    );
    res.end(readFileSync("." + path));
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
  const covers = Object.fromEntries(
    posts.filter((_, i) => app || i !== 1).map((p) => ["blog:" + p.id, image]),
  );
  const design = {
    texts: {},
    images: { "home.gallery.four": image, ...covers },
  };
  if (app) {
    await page.goto(origin + "/admin");
    await page.getByLabel("Şifre", { exact: true }).fill(server.password);
    await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
    await page
      .getByRole("heading", { name: "Genel bakış", exact: true })
      .waitFor();
    const original = await (
      await context.request.get(origin + "/api/admin")
    ).json();
    for (const record of original.content.filter((row) =>
      row.key.startsWith("blog-"),
    )) {
      const response = await context.request.post(origin + "/api/admin", {
        data: { table: "content", action: "delete", record: { id: record.id } },
      });
      assert(response.ok(), await response.text());
    }
    for (const record of posts) {
      const response = await context.request.post(origin + "/api/admin", {
        data: { table: "content", action: "insert", record },
      });
      assert(response.ok(), await response.text());
    }
    let workspace = await (
      await context.request.get(origin + "/api/admin/studio")
    ).json();
    let response = await context.request.post(origin + "/api/admin/studio", {
      data: { action: "design", expectedRevision: workspace.revision, design },
    });
    assert(response.ok(), await response.text());
    workspace = await response.json();
    response = await context.request.post(origin + "/api/admin/studio", {
      data: { action: "publish", expectedRevision: workspace.revision },
    });
    assert(response.ok(), await response.text());
    await page.goto(origin + "/blog");
  } else {
    const html = readFileSync("docs/panel.html", "utf8"),
      catalog = JSON.parse(html.match(/const INITIAL = (\{[^\n]*\});/)[1]);
    catalog.content = catalog.content
      .filter((row) => !row.key.startsWith("blog-"))
      .concat(posts);
    await page.addInitScript(
      ({ key, catalog, design, applied }) => {
        if (!localStorage.getItem(key)) {
          localStorage.setItem(key, JSON.stringify(catalog));
          localStorage.setItem(key + ".design", JSON.stringify(design));
          localStorage.setItem(
            key + ".catalog-updates",
            JSON.stringify(applied),
          );
        }
      },
      {
        key,
        catalog,
        design,
        applied: JSON.parse(
          readFileSync("quick-panel/content-updates.json", "utf8"),
        ).map((row) => row.id),
      },
    );
    await page.goto(origin + "/docs/panel.html");
    await page.locator("#site-page").selectOption("blog");
    await page.locator("#site-inspect").uncheck();
  }
  const view = () => (app ? page : page.frameLocator("#site-frame"));
  await dismissCookies(view());
  await expect(view().locator(".blog-card")).toHaveCount(10);
  assert.equal(await view().locator(".blog-card p").count(), 0);
  assert((await view().locator(".blog-card--wide").count()) >= 2);
  const next = view().getByRole("link", { name: "Sonraki sayfa", exact: true });
  assert((await next.getAttribute("href")).includes("page=2"));
  await next.click();
  await expect(view().locator(".blog-card")).toHaveCount(2);
  if (app) assert(new URL(page.url()).searchParams.get("page") === "2");
  await view().locator(".blog-card").last().click();
  await expect(view().locator(".blog-article h1")).toContainText(
    posts[11].title.tr,
  );
  assert.equal(
    await view().locator(".blog-article-banner img").getAttribute("src"),
    image,
  );
  await view().locator(".blog-article > .text-link").click();
  await expect(view().locator(".blog-card")).toHaveCount(2);
  await view().getByRole("link", { name: "Önceki sayfa", exact: true }).click();
  await expect(view().locator(".blog-card")).toHaveCount(10);
  if (!app) {
    await page.locator("#site-inspect").check();
    await view()
      .locator('.blog-card [data-visual-image="blog:banner-test-1"]')
      .click({ position: { x: 25, y: 25 } });
    await page.waitForFunction(
      () =>
        document
          .querySelector("#site-photo")
          ?.getAttribute("data-image-key") === "blog:banner-test-1",
    );
    await page.locator("#site-photo").setInputFiles("public/images/hero.webp");
    await page.waitForFunction(
      (key) =>
        !!JSON.parse(localStorage.getItem(key + ".design")).images[
          "blog:banner-test-1"
        ],
      key,
    );
    const saved = await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key + ".design")),
      key,
    );
    assert.equal(saved.images["home.gallery.four"], image);
    assert.equal(saved.images["blog:banner-test-0"], image);
    await page.reload();
    await dismissCookies(view());
    await expect(view().locator(".blog-card")).toHaveCount(10);
    const src = await view()
      .locator('.blog-card [data-visual-image="blog:banner-test-1"] img')
      .getAttribute("src");
    assert(src.startsWith("data:image/webp"));
    await page.locator("#site-inspect").uncheck();
    await view().locator(".blog-card").nth(1).click();
    assert.equal(
      await view().locator(".blog-article-banner img").getAttribute("src"),
      src,
    );
    await view().locator(".blog-article > .text-link").click();
  }
  if (app)
    await page.screenshot({
      path: "/tmp/blog-banners-desktop.png",
      fullPage: true,
    });
  else
    await page
      .locator("#site-frame")
      .evaluate((f) => f.contentWindow.scrollTo(0, 0));
  if (app) await page.setViewportSize({ width: 390, height: 844 });
  else
    await page.locator('[data-action="site-device"][data-id="mobile"]').click();
  await expect(view().locator(".blog-card")).toHaveCount(10);
  const fits = await view()
    .locator(".blog-grid")
    .evaluate((grid) => {
      return (
        document.documentElement.scrollWidth <= innerWidth &&
        [...grid.querySelectorAll("h2")].every((h) => {
          const a = h.getBoundingClientRect(),
            b = h.closest(".blog-card").getBoundingClientRect();
          return (
            a.left >= b.left &&
            a.right <= b.right + 1 &&
            a.bottom <= b.bottom + 1
          );
        })
      );
    });
  assert(fits, "Titles and cards must fit the mobile viewport");
  if (app)
    await page.screenshot({
      path: "/tmp/blog-banners-mobile.png",
      fullPage: true,
    });
  assert.deepEqual(errors, []);
  console.log(
    "PASS (" +
      (app ? "production app" : "browser preview") +
      "): ten-post pagination, contextual covers, article/back URLs, image editing/persistence and uncut responsive titles.",
  );
} finally {
  await browser.close();
  if (app) await server.stop();
  else {
    server.closeAllConnections();
    await new Promise((r) => server.close(r));
  }
}
