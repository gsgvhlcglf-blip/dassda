import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
const password =
  process.env.LOCAL_ADMIN_PASSWORD ||
  readFileSync(".env.local", "utf8").match(
    /^LOCAL_ADMIN_PASSWORD=(.+)$/m,
  )?.[1] ||
  "";
test("configuration requires login and edits the real homepage without exposing credentials", async ({
  page,
}) => {
  await page.goto("/admin/ayarlar");
  await expect(
    page.getByRole("heading", { name: "Tekrar hoş geldiniz." }),
  ).toBeVisible();
  await expect(
    page.getByText("Veritabanı sorgusu", { exact: true }),
  ).toHaveCount(0);
  await page.getByLabel("Şifre", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Yapılandırma", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Başarılı", { exact: true })).toBeVisible();
  expect(await page.locator("body").innerText()).not.toContain(password);
  const data = await (await page.request.get("/api/admin")).json();
  const original = data.content.find((r: { key: string }) => r.key === "home");
  try {
    await page
      .getByRole("button", {
        name: "Ana sayfa başlığı ve açıklaması",
        exact: true,
      })
      .click();
    await page
      .getByLabel("Başlık / TR", { exact: true })
      .fill("Yapılandırma testi");
    await page.getByRole("button", { name: "Kaydet", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Yapılandırma testi",
    );
  } finally {
    const response = await page.request.post("/api/admin", {
      data: { table: "content", action: "update", record: original },
    });
    expect(response.ok()).toBeTruthy();
  }
});
