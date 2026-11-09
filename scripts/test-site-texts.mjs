import { chromium, expect } from "@playwright/test";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { testAppServer } from "./test-app-server.mjs";
import { dismissCookies } from "./test-cookie-helper.mjs";

const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
const oldNote =
  "Her marka ve model için başvurabilirsin. Onay ve gönderim koşulları iletilmeden parçanı kargolama.";
const heading = ".request-simple-heading > p:not(.eyebrow)";
const replacement = "Sana özel üretim. <img src=x onerror=alert(1)>";
try {
  for (const app of [false, true]) {
    let server, origin;
    if (app) {
      server = await testAppServer();
      origin = server.origin;
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
      viewport: { width: 1440, height: 1000 },
    });
    const page = await context.newPage(),
      shop = await context.newPage(),
      errors = [];
    for (const tab of [page, shop])
      tab.on("pageerror", (error) => errors.push(error.message));
    try {
      await shop.goto(
        origin +
          (app
            ? "/parcani-urettir"
            : "/docs/store.html?workspace-view=draft#/parcani-urettir"),
      );
      await dismissCookies(shop);
      const original = await shop.locator(heading).innerText();
      assert(!(await shop.locator("body").innerText()).includes(oldNote));
      await expect(shop.locator(".request-simple-note")).toHaveCount(0);
      await page.goto(origin + (app ? "/admin" : "/docs/panel.html"));
      if (app) {
        await page.getByLabel("Şifre", { exact: true }).fill(server.password);
        await page
          .getByRole("button", { name: "Giriş yap", exact: true })
          .click();
        await page
          .getByRole("button", { name: "Site metinleri", exact: true })
          .click();
      } else {
        await page.locator("#site-page").selectOption("custom");
        const frame = page.frameLocator("#site-frame");
        await dismissCookies(frame);
        await frame.locator(heading).click();
        await expect(page.getByLabel("Seçili metni düzenle")).toHaveValue(
          original,
        );
        await page.getByLabel("Seçili metni düzenle").fill(replacement);
        await expect(frame.locator(heading)).toHaveText(replacement);
        await expect(frame.locator(heading + " img")).toHaveCount(0);
        await page.reload();
        await dismissCookies(frame);
        await expect(frame.locator(heading)).toHaveText(replacement);
        await frame.locator(heading).click();
        await page
          .getByRole("button", { name: "Metni kaldır", exact: true })
          .click();
        await expect(frame.locator(heading)).toHaveText("");
        await page.reload();
        await dismissCookies(frame);
        await expect(frame.locator(heading)).toHaveText("");
        await frame.getByText("Parça uzunluğu (cm)", { exact: true }).click();
        await expect(page.getByLabel("Seçili metni düzenle")).toHaveValue(
          "Parça uzunluğu (cm)",
        );
        await page.getByLabel("Seçili metni düzenle").fill("Parça boyu (cm)");
        await expect(
          frame.getByLabel("Parça boyu (cm)", { exact: true }),
        ).toBeVisible();
        await expect(
          frame.getByLabel("Parça boyu (cm)", { exact: true }),
        ).toHaveAttribute("required", "");
        await frame.getByText("Talebini gönder", { exact: true }).click();
        await expect(page.getByLabel("Seçili metni düzenle")).toHaveValue(
          "Talebini gönder",
        );
        await page.getByLabel("Seçili metni düzenle").fill("Teklif iste");
        await expect(
          frame.getByRole("button", { name: "Teklif iste", exact: true }),
        ).toBeVisible();
        await expect(frame.locator(".request-simple-submit svg")).toBeVisible();
        await frame.getByText("Forged Carbon", { exact: true }).click();
        await expect(page.getByLabel("Seçili metni düzenle")).toHaveValue(
          "Forged Carbon",
        );
        await page.getByLabel("Seçili metni düzenle").fill("Forged Karbon");
        await expect(
          frame.getByRole("radio", { name: "Forged Karbon", exact: true }),
        ).toBeVisible();
        await page
          .getByRole("button", { name: "Tüm metinler", exact: true })
          .click();
      }
      const manager = () => page.locator(".site-texts-editor");
      const selectText = async (text) => {
        await manager()
          .getByRole("searchbox", { name: "Site metinlerinde ara" })
          .fill(text);
        await manager()
          .locator(".site-texts-list button")
          .filter({ hasText: text })
          .first()
          .click();
      };
      await selectText(original);
      await manager()
        .getByRole("button", { name: "Varsayılanı geri getir", exact: true })
        .click();
      await expect(manager().getByRole("status")).toHaveText(
        "Metin kaydedildi.",
      );
      await expect(manager().getByLabel("Site metnini düzenle")).toHaveValue(
        original,
      );
      await manager().getByLabel("Site metnini düzenle").fill(replacement);
      await manager()
        .getByRole("button", { name: "Metni kaydet", exact: true })
        .click();
      await expect(manager().getByRole("status")).toHaveText(
        "Metin kaydedildi.",
      );
      if (app) {
        const snapshot = await (
          await context.request.get(origin + "/api/admin/studio")
        ).json();
        assert(
          Object.values(snapshot.snapshot.design.texts.tr).includes(
            replacement,
          ),
        );
        await shop.goto(origin + "/taslak-onizleme?path=%2Fparcani-urettir");
        await expect(shop.locator(heading)).toHaveText(replacement);
        await shop.goto(origin + "/parcani-urettir");
        await expect(shop.locator(heading)).toHaveText(original);
        await page
          .getByRole("button", { name: "Yayın & sürümler", exact: true })
          .click();
        await page
          .getByRole("button", { name: "Taslağı yayınla", exact: true })
          .click();
        await expect(page.locator(".studio-version").first()).toBeVisible();
        await shop.reload();
        await expect(shop.locator(heading)).toHaveText(replacement);
        await expect(shop.locator(heading + " img")).toHaveCount(0);
        await page
          .getByRole("button", { name: "Site metinleri", exact: true })
          .click();
      }
      await selectText("Talep formu · Alt açıklama");
      await manager()
        .getByLabel("Site metnini düzenle")
        .fill("Yeni bir açıklama.");
      await manager()
        .getByRole("button", { name: "Metni kaydet", exact: true })
        .click();
      await expect(manager().getByRole("status")).toHaveText(
        "Metin kaydedildi.",
      );
      if (!app) {
        await page
          .getByRole("button", { name: "Metin penceresini kapat" })
          .click();
        await expect(
          page.frameLocator("#site-frame").locator(".request-simple-note"),
        ).toHaveText("Yeni bir açıklama.");
        await page
          .getByRole("button", { name: "Tüm metinler", exact: true })
          .click();
      }
      await manager()
        .getByRole("button", { name: "Metni kaldır", exact: true })
        .click();
      await expect(manager().getByLabel("Site metnini düzenle")).toHaveValue(
        "",
      );
      await page.setViewportSize({ width: 390, height: 844 });
      assert(
        await page
          .locator("html")
          .evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      );
      await page.screenshot({
        path: `/tmp/site-texts-${app ? "app" : "preview"}-mobile.png`,
      });
      if (!app) {
        await page
          .getByRole("button", { name: "Metin penceresini kapat" })
          .click();
        await shop.reload();
        await expect(shop.locator(heading)).toHaveText(replacement);
        await expect(shop.locator(".request-simple-note")).toHaveCount(0);
        const body = await shop
          .locator('input[name="length_cm"]')
          .evaluate((input) => ({ required: input.required, min: input.min }));
        assert.deepEqual(body, { required: true, min: "0.01" });
      }
      assert.deepEqual(errors, []);
      console.log(
        `PASS (${app ? "app" : "preview"}): removed default note; general copy edit/delete/restore; blank persistence; literal HTML; mobile editor; ${app ? "authenticated API draft/publish separation" : "direct editing and customer synchronization"}.`,
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
