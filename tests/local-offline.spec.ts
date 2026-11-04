import { test, expect } from "@playwright/test";
test("local launcher supports browser-only editing with Internet requests blocked", async ({
  page,
}) => {
  test.skip(
    !process.env.KUZMIN_TEST_LOCAL_PASSWORD,
    "Run via node scripts/test-local-offline.mjs for the chosen-password local server.",
  );
  const external: string[] = [];
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (
      ["http:", "https:"].includes(url.protocol) &&
      !["localhost", "127.0.0.1"].includes(url.hostname)
    ) {
      external.push(url.origin);
      return route.abort();
    }
    return route.continue();
  });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Detayda fark yarat",
  );
  await expect(page.locator(".hero img")).toBeVisible();
  await expect
    .poll(() =>
      page
        .locator(".hero img")
        .evaluate((image: HTMLImageElement) => image.naturalWidth),
    )
    .toBeGreaterThan(0);
  await page.goto("/admin/ayarlar");
  await page
    .getByLabel("Şifre", { exact: true })
    .fill(process.env.KUZMIN_TEST_LOCAL_PASSWORD!);
  await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Yapılandırma", exact: true }),
  ).toBeVisible();
  const data = await (await page.request.get("/api/admin")).json();
  const original = data.content.find(
    (r: { key: string }) => r.key === "contact",
  );
  try {
    await page
      .getByRole("button", { name: "İletişim bilgileri", exact: true })
      .click();
    await page
      .getByLabel("İçerik / TR", { exact: true })
      .fill("Yerel düzenleme testi: bu metin internet olmadan kaydedildi.");
    await page.getByRole("button", { name: "Kaydet", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    const workspace = await (
      await page.request.get("/api/admin/studio")
    ).json();
    expect(
      (
        await page.request.post("/api/admin/studio", {
          data: { action: "publish", expectedRevision: workspace.revision },
        })
      ).ok(),
    ).toBeTruthy();
    await page.goto("/iletisim");
    await expect(page.locator(".content-body")).toContainText(
      "Yerel düzenleme testi",
    );
    await page.reload();
    await expect(page.locator(".content-body")).toContainText(
      "Yerel düzenleme testi",
    );
  } finally {
    const result = await page.request.post("/api/admin", {
      data: { table: "content", action: "update", record: original },
    });
    expect(result.ok()).toBeTruthy();
    const restored = await (await page.request.get("/api/admin/studio")).json();
    expect(
      (
        await page.request.post("/api/admin/studio", {
          data: { action: "publish", expectedRevision: restored.revision },
        })
      ).ok(),
    ).toBeTruthy();
  }
  expect(external).toEqual([]);
});
