import { test, expect } from "@playwright/test";
test("checkout requires a customer session and each member sees only their own orders", async ({
  browser,
  request,
  page,
}) => {
  const anonymous = await request.get("/api/customer");
  expect(anonymous.status()).toBe(401);
  expect((await request.post("/api/orders", { data: {} })).status()).toBe(401);
  await page.goto("/odeme");
  await expect(page).toHaveURL(/giris\?next=/);
  const baseURL = test.info().project.use.baseURL;
  const a = await browser.newContext({ baseURL }),
    b = await browser.newContext({ baseURL });
  try {
    const stamp = Date.now();
    const email = `member-a-${stamp}@example.test`,
      password = "Private-test-123456";
    const register = await a.request.post("/api/customer", {
      data: { action: "signup", email, password, consent: true },
    });
    expect(register.status()).toBe(200);
    expect(
      (await a.cookies()).find((c) => c.name === "kz_customer")?.httpOnly,
    ).toBe(true);
    expect((await a.request.get("/api/admin")).status()).toBe(401);
    const order = await a.request.post("/api/orders", {
      data: {
        customer_name: "Member A",
        email: "forged@example.test",
        phone: "05000000000",
        address: "Private test address 10",
        note: "",
        consent: true,
        locale: "tr",
        lines: [{ productId: "p1", variantId: "p1-gloss", quantity: 1 }],
      },
    });
    expect(order.status()).toBe(201);
    const result = await order.json();
    const own = await (await a.request.get("/api/customer")).json();
    expect(own.user.email).toBe(email);
    expect(
      own.orders.some(
        (o: { reference: string }) => o.reference === result.reference,
      ),
    ).toBe(true);
    expect(
      (
        await b.request.post("/api/customer", {
          data: {
            action: "signup",
            email: `member-b-${stamp}@example.test`,
            password,
            consent: true,
          },
        })
      ).status(),
    ).toBe(200);
    const other = await (await b.request.get("/api/customer")).json();
    expect(other.orders).toEqual([]);
    expect(
      (
        await a.request.post("/api/customer", { data: { action: "logout" } })
      ).status(),
    ).toBe(200);
    expect((await a.request.get("/api/customer")).status()).toBe(401);
    expect((await a.request.post("/api/orders", { data: {} })).status()).toBe(
      401,
    );
    expect(
      (
        await a.request.post("/api/customer", {
          data: { action: "login", email, password: "incorrect-password-123" },
        })
      ).status(),
    ).toBe(401);
    expect(
      (
        await a.request.post("/api/customer", {
          data: { action: "login", email, password },
        })
      ).status(),
    ).toBe(200);
    expect((await a.request.get("/api/customer")).status()).toBe(200);
  } finally {
    await a.close();
    await b.close();
  }
});
