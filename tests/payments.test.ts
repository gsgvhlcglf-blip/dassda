import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import {
  paytrToken,
  paytrCallbackSignature,
  iyzicoAuthorization,
  iyzicoSignature,
  minorUnits,
  amountString,
  safeCheckoutURL,
} from "../src/lib/payments/protocol";
import {
  initializeGateway,
  retrieveIyzico,
  verifyPaytrCallback,
} from "../src/lib/payments/providers";
import type { PaymentAttempt, PaymentOrder } from "../src/lib/payments/types";
const order: PaymentOrder = {
  reference: "KZ-testorder",
  customer_name: "Test Member",
  email: "member@example.test",
  phone: "+905000000000",
  address: "Example test address 10",
  total: 13.7,
  items: [
    {
      title: "Örnek parça",
      quantity: 2,
      unit_price: 6.85,
      variant_id: "test-variant",
    },
  ],
};
const base: PaymentAttempt = {
  id: randomUUID(),
  order_id: "test-order",
  customer_id: randomUUID(),
  provider: "paytr",
  mode: "test",
  state: "creating",
  amount_minor: 1370,
  currency: "TRY",
  merchant_ref: "KZ" + randomUUID().replaceAll("-", ""),
  token: null,
  checkout_url: null,
  provider_payment_id: null,
  reserved: false,
  created_at: new Date().toISOString(),
  expires_at: new Date(Date.now() + 1800000).toISOString(),
  error_code: null,
};
const paytr = {
  id: "test-merchant",
  key: "test-key-not-a-real-credential",
  salt: "test-salt",
};
test("money and hosted checkout destinations reject malformed amounts and foreign hosts", () => {
  assert.equal(minorUnits("13.70"), 1370);
  assert.equal(amountString(1370), "13.70");
  for (const amount of ["NaN", "-1", "1.001", "1e3", "1.2x"])
    assert.throws(() => minorUnits(amount));
  for (const url of [
    "http://cpp.iyzipay.com",
    "https://evil.test",
    "https://cpp.iyzipay.com.evil.test",
    "https://cpp.iyzipay.com@evil.test",
  ])
    assert.throws(() => safeCheckoutURL("iyzico", "live", url));
  assert.throws(() =>
    safeCheckoutURL("iyzico", "test", "https://cpp.iyzipay.com?token=x"),
  );
});
test("PayTR token follows official concatenation; invalid callback signature and altered totals are rejected", async () => {
  let sent: URLSearchParams | undefined;
  const session = await initializeGateway(
    base,
    order,
    { ip: "203.0.113.10" },
    "https://merchant.example.test",
    { paytr },
    async (url, options) => {
      assert.equal(url, "https://www.paytr.com/odeme/api/get-token");
      sent = new URLSearchParams(String(options?.body));
      return Response.json({ status: "success", token: "testtoken1234567890" });
    },
  );
  const fields = sent!;
  assert.equal(fields.get("payment_amount"), "1370");
  assert.equal(fields.get("test_mode"), "1");
  assert.equal(fields.get("no_installment"), "1");
  assert.equal(fields.get("merchant_ok_url"), fields.get("merchant_fail_url"));
  const message =
    paytr.id +
    "203.0.113.10" +
    base.merchant_ref +
    order.email +
    "1370" +
    fields.get("user_basket") +
    "10TL1" +
    paytr.salt;
  assert.equal(
    fields.get("paytr_token"),
    createHmac("sha256", paytr.key).update(message).digest("base64"),
  );
  assert.match(session.url, /^https:\/\/www.paytr.com\/odeme\/guvenli\//);
  const input = {
    merchant_oid: base.merchant_ref,
    status: "success",
    total_amount: "1370",
    hash: paytrCallbackSignature(
      base.merchant_ref,
      "success",
      "1370",
      paytr.key,
      paytr.salt,
    ),
  };
  assert.equal(verifyPaytrCallback(input, base, paytr).paid, true);
  assert.throws(() =>
    verifyPaytrCallback({ ...input, total_amount: "1" }, base, paytr),
  );
  assert.throws(() =>
    verifyPaytrCallback({ ...input, hash: "fake" }, base, paytr),
  );
});
test("iyzico request and result signatures follow official v2 protocol; results are matched to saved token/order", async () => {
  const c = { key: "test-api-key", secret: "test-secret-not-real" },
    a = { ...base, provider: "iyzico" as const };
  const auth = iyzicoAuthorization(
    "/test",
    '{"price":"13.70"}',
    c.key,
    c.secret,
    "fixed-nonce",
  );
  const decoded = Buffer.from(
    auth.authorization.split(" ")[1],
    "base64",
  ).toString();
  assert.equal(
    decoded,
    "apiKey:" +
      c.key +
      "&randomKey:fixed-nonce&signature:" +
      createHmac("sha256", c.secret)
        .update('fixed-nonce/test{"price":"13.70"}')
        .digest("hex"),
  );
  let requestBody: Record<string, any> = {};
  const created = await initializeGateway(
    a,
    order,
    {
      ip: "203.0.113.10",
      city: "Test City",
      country: "Turkey",
      identity: "TESTPASSPORT",
    },
    "https://merchant.example.test",
    { iyzico: c },
    async (url, options) => {
      assert.match(String(url), /^https:\/\/sandbox-api.iyzipay.com\//);
      requestBody = JSON.parse(String(options?.body));
      assert.equal(requestBody.price, "13.70");
      assert.equal(requestBody.basketItems[0].price, "13.70");
      assert.equal(requestBody.buyer.identityNumber, "TESTPASSPORT");
      assert.equal("paymentCard" in requestBody, false);
      const token = "test-iyzico-token";
      return Response.json({
        status: "success",
        conversationId: a.id,
        token,
        paymentPageUrl: "https://sandbox-cpp.iyzipay.com?token=" + token,
        signature: iyzicoSignature([a.id, token], c.secret),
      });
    },
  );
  let result = {
    status: "success",
    paymentStatus: "SUCCESS",
    paymentId: "test-payment",
    currency: "TRY",
    basketId: a.merchant_ref,
    conversationId: a.id,
    paidPrice: 13.7,
    price: 13.7,
    token: created.token,
    fraudStatus: 1,
    signature: "",
  };
  result.signature = iyzicoSignature(
    [
      result.paymentStatus,
      result.paymentId,
      result.currency,
      result.basketId,
      result.conversationId,
      result.paidPrice,
      result.price,
      result.token,
    ],
    c.secret,
  );
  const saved = { ...a, token: created.token };
  assert.equal(
    (
      await retrieveIyzico(saved, created.token, c, async () =>
        Response.json(result),
      )
    ).paid,
    true,
  );
  await assert.rejects(
    retrieveIyzico(saved, "foreign-token", c, async () =>
      Response.json(result),
    ),
    /TOKEN_MISMATCH/,
  );
  await assert.rejects(
    retrieveIyzico(saved, created.token, c, async () =>
      Response.json({ ...result, paidPrice: 1 }),
    ),
    /INVALID_SIGNATURE/,
  );
});
test("payment SQL enforces private RPCs, stock reservations, amount checks, idempotency, failures, expiry and late-payment review", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;alter default privileges in schema public grant select,insert,update,delete on tables to anon,authenticated;`,
    );
    await db.exec(readFileSync("supabase/migrations/001_store.sql", "utf8"));
    await db.exec(readFileSync("supabase/seed.sql", "utf8"));
    await db.exec(
      readFileSync("supabase/migrations/002_customer_membership.sql", "utf8"),
    );
    await db.exec(readFileSync("supabase/migrations/006_payments.sql", "utf8"));
    const member = "00000000-0000-0000-0000-000000000001";
    await db.exec(
      `insert into auth.users values('${member}','member@example.test',now());update public.products set demo=false,stock=5 where id='p1';update public.variants set stock=5 where id='p1-gloss';update public.payment_settings set provider='paytr',mode='live',enabled=true;set role anon;`,
    );
    assert.equal(
      (await db.query("select * from public.payment_attempts")).rows.length,
      0,
    );
    await assert.rejects(
      db.query("select public.prepare_payment('unknown',$1::uuid)", [member]),
      /permission denied/,
    );
    await assert.rejects(
      db.query(
        "select public.settle_payment($1::uuid,true,1370000,'TRY','forged')",
        [base.id],
      ),
      /permission denied/,
    );
    async function createOrder() {
      await db.exec(
        `set role authenticated;set request.jwt.claim.sub='${member}'`,
      );
      const response = await db.query<{ o: { reference: string } }>(
        "select public.create_order_request($1::jsonb) as o",
        [
          JSON.stringify({
            customer_name: "Test Member",
            email: "wrong@example.test",
            phone: "05000000000",
            address: "A test shipping address 10",
            note: "",
            consent: true,
            locale: "tr",
            lines: [{ productId: "p1", variantId: "p1-gloss", quantity: 2 }],
          }),
        ],
      );
      await db.exec("set role service_role");
      return response.rows[0].o.reference;
    }
    async function prepare(ref: string) {
      return (
        await db.query<{ a: PaymentAttempt & { created: boolean } }>(
          "select public.prepare_payment($1,$2::uuid,'paytr','live') as a",
          [ref, member],
        )
      ).rows[0].a;
    }
    async function settle(
      a: PaymentAttempt,
      paid: boolean,
      amount = a.amount_minor,
    ) {
      return (
        await db.query<{ state: string }>(
          "select public.settle_payment($1::uuid,$2,$3::bigint,$4,$5) as state",
          [a.id, paid, amount, "TRY", "verified-test-transaction"],
        )
      ).rows[0].state;
    }
    const ref = await createOrder();
    await assert.rejects(
      db.query("select public.prepare_payment($1,$2::uuid,'paytr','test')", [
        ref,
        member,
      ]),
      /PAYMENT_CONFIGURATION_CHANGED/,
    );
    const first = await prepare(ref);
    assert(first.created);
    assert.equal((await prepare(ref)).id, first.id);
    await db.exec("reset role");
    assert.equal(
      (
        await db.query<{ stock: number }>(
          "select stock from products where id='p1'",
        )
      ).rows[0].stock,
      3,
    );
    await db.exec("set role service_role");
    assert.equal(await settle(first, true), "paid");
    assert.equal(await settle(first, true), "paid");
    assert.equal(await settle(first, false), "paid");
    await db.exec("reset role");
    assert.equal(
      (
        await db.query<{ stock: number }>(
          "select stock from products where id='p1'",
        )
      ).rows[0].stock,
      3,
    );
    const second = await prepare(await createOrder());
    assert.equal(await settle(second, false), "failed");
    assert.equal(await settle(second, false), "failed");
    await db.exec("reset role");
    assert.equal(
      (
        await db.query<{ stock: number }>(
          "select stock from products where id='p1'",
        )
      ).rows[0].stock,
      3,
    );
    const third = await prepare(await createOrder());
    assert.equal(await settle(third, true, 1), "review");
    await db.exec("reset role");
    assert.equal(
      (
        await db.query<{ status: string }>(
          "select status from orders where id=$1",
          [third.order_id],
        )
      ).rows[0].status,
      "reviewing",
    );
    await db.exec(
      "update products set stock=5 where id='p1';update variants set stock=5 where id='p1-gloss'",
    );
    const fourth = await prepare(await createOrder());
    await db.exec(
      "reset role;update payment_attempts set expires_at=now()-interval '1 minute' where id='" +
        fourth.id +
        "';set role service_role;select public.expire_payment_attempts()",
    );
    await db.exec(
      "reset role;update products set stock=0 where id='p1';update variants set stock=0 where id='p1-gloss';set role service_role",
    );
    assert.equal(await settle(fourth, true), "review");
    await db.exec("reset role");
    assert.equal(
      (
        await db.query<{ stock: number }>(
          "select stock from products where id='p1'",
        )
      ).rows[0].stock,
      0,
    );
  } finally {
    await db.close();
  }
});
