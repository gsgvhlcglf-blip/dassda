import { test, expect } from "@playwright/test";
import { dismissCookies } from "../scripts/test-cookie-helper.mjs";
test("guest checkout disables accounts and isolates orders without passwords", async ({
  browser,
  page,
}) => {
  const baseURL = test.info().project.use.baseURL;
  const a = await browser.newContext({ baseURL }),
    b = await browser.newContext({ baseURL });
  try {
    for (const action of ["signup", "login"]) {
      expect(
        (
          await a.request.post("/api/customer", {
            data: {
              action,
              email: "guest@example.test",
              password: "Private-test-123456",
              consent: true,
            },
          })
        ).status(),
      ).toBe(410);
    }
    await page.goto("/urunler/karbon-on-camurluk");
    await dismissCookies(page);
    await page
      .getByRole("button", { name: "Sepete ekle", exact: true })
      .click();
    await page.getByRole("link", { name: "Sepet (1)", exact: true }).click();
    await page.getByRole("link", { name: "Ödeme yapın", exact: true }).click();
    await expect(page.locator(".checkout-form")).toBeVisible();
    await expect(page.locator('input[type="password"]')).toHaveCount(0);
    await expect(page).toHaveURL(/\/odeme$/);
    await expect(
      page.locator('a[href="/giris"], a[href="/uye-ol"], a[href="/hesabim"]'),
    ).toHaveCount(0);
    expect((await a.request.get("/api/admin")).status()).toBe(401);
    const response = await a.request.post("/api/orders", {
      data: {
        customer_name: "Guest A",
        email: "guest@example.test",
        phone: "05000000000",
        address: "Private test address 10",
        note: "",
        consent: true,
        locale: "tr",
        lines: [{ productId: "p1", variantId: "p1-gloss", quantity: 1 }],
        total: 1,
      },
    });
    expect(response.status()).toBe(201);
    const order = await response.json();
    expect(order.total).toBeGreaterThan(1);
    expect(
      (await a.cookies()).find((c) => c.name === "kz_guest")?.httpOnly,
    ).toBe(true);
    expect((await a.cookies()).some((c) => c.name === "kz_customer")).toBe(
      false,
    );
    const own = await (await a.request.get("/api/orders")).json();
    expect(
      own.orders.some(
        (o: { reference: string }) => o.reference === order.reference,
      ),
    ).toBe(true);
    expect(
      await (
        await b.request.get(
          "/api/orders?reference=" +
            encodeURIComponent(order.reference) +
            "&email=guest@example.test",
        )
      ).json(),
    ).toEqual({ orders: [] });
    expect(JSON.stringify(own)).not.toContain("guest_key");
    expect(JSON.stringify(own)).not.toContain("guest@example.test");
  } finally {
    await a.close();
    await b.close();
  }
});
