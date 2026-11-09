import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { join } from "node:path";
import { seed } from "../src/lib/seed.ts";
import {
  applyModelGenerations,
  currentModelYear,
} from "../src/lib/model-generations.ts";
import { testAppServer } from "./test-app-server.mjs";
import { dismissCookies } from "./test-cookie-helper.mjs";

const modelId = "yamaha-mt-25",
  key = "kuzmin.workspace.gsgvhlcglf-blip.dassda.v1";
function fixture(catalog) {
  const original = structuredClone(catalog);
  original.compatibility = original.compatibility.filter(
    (row) => row.model_id !== modelId,
  );
  const catalogWithRanges = applyModelGenerations(original, modelId, [
    { id: "range-first", name: "1. nesil", start_year: 2014, end_year: 2017 },
    { id: "range-second", name: "2. nesil", start_year: 2018, end_year: 2021 },
    {
      id: "range-current",
      name: "3. nesil",
      start_year: 2022,
      end_year: currentModelYear(),
      ongoing: true,
    },
  ]);
  catalogWithRanges.compatibility.push(
    {
      id: "range-full-fit",
      model_id: modelId,
      product_id: "p1",
      generation_id: "range-first",
      year_from: 2014,
      year_to: 2017,
    },
    {
      id: "range-partial-fit",
      model_id: modelId,
      product_id: "p2",
      generation_id: "range-first",
      year_from: 2016,
      year_to: 2017,
    },
  );
  return catalogWithRanges;
}
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
try {
  for (const app of [false, true]) {
    let server, origin;
    if (app) {
      server = await testAppServer();
      origin = server.origin;
      const db = new DatabaseSync(join(server.directory, ".data/store.sqlite")),
        data = fixture(seed);
      try {
        db.exec("BEGIN");
        for (const table of ["compatibility", "model_years", "generations"])
          db.prepare(`DELETE FROM ${table} WHERE model_id=?`).run(modelId);
        for (const table of ["generations", "model_years", "compatibility"]) {
          for (const row of data[table].filter(
            (row) => row.model_id === modelId,
          )) {
            const fields = Object.keys(row);
            db.prepare(
              `INSERT INTO ${table} (${fields.join(",")}) VALUES (${fields.map(() => "?").join(",")})`,
            ).run(
              ...fields.map((field) =>
                typeof row[field] === "boolean"
                  ? Number(row[field])
                  : row[field],
              ),
            );
          }
        }
        if (
          db
            .prepare(
              "SELECT name FROM sqlite_master WHERE name='site_workspace'",
            )
            .get()
        )
          db.prepare("UPDATE site_workspace SET catalog=? WHERE id='site'").run(
            JSON.stringify(data),
          );
        db.exec("COMMIT");
      } finally {
        db.close();
      }
    } else {
      server = createServer((req, res) => {
        const path = new URL(req.url, "http://localhost").pathname;
        if (
          !/^\/docs\/(panel\.html|store\.html|panel-version\.json)$/.test(path)
        )
          return res.writeHead(404).end();
        res.setHeader(
          "Content-Type",
          path.endsWith("json")
            ? "application/json"
            : "text/html; charset=utf-8",
        );
        res.end(readFileSync("." + path));
      });
      await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
      origin = "http://127.0.0.1:" + server.address().port;
    }
    const context = await browser.newContext({
        viewport: { width: 1280, height: 1000 },
      }),
      page = await context.newPage(),
      errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    try {
      if (!app) {
        const initial = JSON.parse(
          readFileSync("docs/panel.html", "utf8").match(
            /const INITIAL = (\{[^\n]*\});/,
          )[1],
        );
        await context.addInitScript(
          ({ key, data }) => {
            if (!localStorage.getItem(key)) {
              localStorage.setItem(key, JSON.stringify(data));
              localStorage.setItem(
                key + ".preview-ui",
                JSON.stringify({
                  page: "years",
                  brand: "yamaha",
                  model: "yamaha-mt-25",
                  year: 2024,
                  device: "desktop",
                  inspect: false,
                  editorVersion: 2,
                }),
              );
            }
          },
          { key, data: fixture(initial) },
        );
      }
      const visit = async (path) => {
        await page.goto(
          origin +
            (app ? path : "/docs/store.html?workspace-view=draft#" + path),
        );
        await dismissCookies(page);
      };
      const base = "/motosikletler/yamaha/mt-25";
      await visit(base);
      await expect(page.locator(".years a")).toHaveCount(3);
      assert.deepEqual(
        await page
          .locator(".years a")
          .evaluateAll((links) =>
            links.map((link) => link.getAttribute("aria-label")),
          ),
        ["2022–Günümüz", "2018–2021", "2014–2017"],
      );
      await expect(
        page.getByRole("link", { name: "2014", exact: true }),
      ).toHaveCount(0);
      for (const width of [1280, 390]) {
        await page.setViewportSize({ width, height: 1000 });
        const rows = await page
          .locator(".years a")
          .evaluateAll((links) =>
            links.map((link) => ({
              x: link.getBoundingClientRect().x,
              y: link.getBoundingClientRect().y,
            })),
          );
        assert(rows.every((row) => row.x === rows[0].x));
        assert(rows[0].y < rows[1].y && rows[1].y < rows[2].y);
        assert(
          await page
            .locator("html")
            .evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        );
        await page
          .locator(".years")
          .screenshot({
            path: `/tmp/generation-ranges-${app ? "app" : "preview"}-${width}.png`,
          });
      }
      await page.getByRole("link", { name: "2014–2017", exact: true }).click();
      await expect(page.locator(".selection-strip")).toContainText("2014–2017");
      await expect(page.locator(".product-card")).toHaveCount(2);
      await expect(page.locator(".product-fitment-years")).toHaveText(
        "Uyumlu yıllar: 2016–2017",
      );
      await page.reload();
      await dismissCookies(page);
      await expect(page.locator(".product-card")).toHaveCount(2);
      const product = page.locator(".product-card").first();
      const productURL = new URL(await product.getAttribute("href"), origin);
      assert.equal(productURL.searchParams.get("range"), "2014-2017");
      assert.equal(productURL.searchParams.get("year"), null);
      await product.click();
      await expect(page.locator(".product-detail")).toBeVisible();
      await page.locator(".request-options .button").click();
      await expect(page.getByLabel("Marka", { exact: true })).toHaveValue(
        "YAMAHA",
      );
      await expect(page.getByLabel("Model", { exact: true })).toHaveValue(
        "MT-25",
      );
      await expect(page.getByLabel("Yıl", { exact: true })).toHaveValue("");
      await visit(base + "/2015");
      await expect(page.locator(".product-card")).toHaveCount(1);
      await visit(base + "/2018-2021");
      await expect(page.locator(".quote-request-empty")).toBeVisible();
      await expect(page.locator(".product-card")).toHaveCount(0);
      if (!app) {
        await page.setViewportSize({ width: 1440, height: 1000 });
        await page.goto(origin + "/docs/panel.html#onizleme");
        await page.locator("#site-page").selectOption("fitment");
        await expect(
          page.getByLabel("Yıl aralığı", { exact: true }).locator("option"),
        ).toHaveCount(3);
        await page
          .getByLabel("Yıl aralığı", { exact: true })
          .selectOption("2014-2017");
        await expect(
          page.frameLocator("#site-frame").locator(".product-card"),
        ).toHaveCount(2);
        await page.reload();
        await expect(
          page.getByLabel("Yıl aralığı", { exact: true }),
        ).toHaveValue("2014-2017");
        await expect(
          page.frameLocator("#site-frame").locator(".product-card"),
        ).toHaveCount(2);
      }
      assert.deepEqual(errors, []);
      console.log(
        `PASS (${app ? "app" : "preview"}): 3 generation rows, ongoing range, mobile alignment, partial fitment labels, exact legacy links, reload, product/request context${app ? "" : " and saved panel range filter"}.`,
      );
    } finally {
      await context.close();
      if (app) await server.stop();
      else {
        server.closeAllConnections();
        await new Promise((resolve) => server.close(resolve));
      }
    }
  }
} finally {
  await browser.close();
}
