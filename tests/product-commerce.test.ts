import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { seed } from "../src/lib/seed";
import { quote } from "../src/lib/commerce";
import {
  salePrice,
  productVariants,
  withProductFinishes,
} from "../src/lib/product-commerce";
import { schemas } from "../src/lib/validation";

test("made-to-order prices ignore legacy stock and variant prices; matte is opt-in", () => {
  const catalog = structuredClone(seed),
    product = catalog.products[0];
  product.stock = 0;
  product.discount_percent = 20;
  catalog.variants.find((v) => v.id === "p1-gloss")!.price = 1;
  const lines = [{ productId: "p1", variantId: "p1-gloss", quantity: 2 }];
  assert.equal(quote(catalog, lines).total, 10960);
  assert.equal(quote(catalog, lines).items[0].unit_price, salePrice(product));
  assert.equal(salePrice({ price: 19.99, discount_percent: 12.5 }), 17.49);
  assert.throws(
    () => quote(catalog, [{ ...lines[0], variantId: "p1-matte" }]),
    /INVALID_VARIANT/,
  );
  product.matte_enabled = true;
  assert.equal(
    quote(catalog, [{ ...lines[0], variantId: "p1-matte" }]).total,
    10960,
  );
  assert.throws(
    () => quote(catalog, [{ ...lines[0], quantity: 99 }, lines[0]]),
    /INVALID_QUANTITY/,
  );
  for (const discount_percent of [-1, 100.01, Infinity, NaN])
    assert.equal(
      schemas.products.safeParse({ ...product, discount_percent }).success,
      false,
    );
});

test("new products have gloss; toggling matte retains historical variant identities", () => {
  const catalog = structuredClone(seed);
  catalog.variants = catalog.variants.filter((v) => v.product_id !== "p1");
  const gloss = withProductFinishes(catalog, "p1");
  assert.deepEqual(
    productVariants(gloss.products[0], gloss.variants).map((v) => v.finish),
    ["gloss"],
  );
  const glossId = gloss.variants.find((v) => v.product_id === "p1")!.id;
  gloss.products[0].matte_enabled = true;
  const both = withProductFinishes(gloss, "p1");
  assert.deepEqual(
    productVariants(both.products[0], both.variants).map((v) => v.finish),
    ["gloss", "matte"],
  );
  both.products[0].matte_enabled = false;
  const hidden = withProductFinishes(both, "p1");
  assert.equal(hidden.variants.filter((v) => v.product_id === "p1").length, 2);
  assert.equal(
    productVariants(hidden.products[0], hidden.variants)[0].id,
    glossId,
  );
});

test("PostgreSQL made-to-order checkout calculates discounts, rejects disabled finishes and preserves verified-payment protections", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;alter default privileges in schema public grant select,insert,update,delete on tables to anon,authenticated;`,
    );
    for (const file of [
      "001_store.sql",
      "002_customer_membership.sql",
      "006_payments.sql",
      "013_product_commerce.sql",
    ])
      await db.exec(readFileSync("supabase/migrations/" + file, "utf8"));
    await db.exec(readFileSync("supabase/seed.sql", "utf8"));
    await db.exec("grant select on public.products to service_role");
    const member = "00000000-0000-0000-0000-000000000001";
    await db.exec(
      `insert into auth.users values('${member}','member@example.test',now());update products set price=1000,discount_percent=12.5,demo=false,stock=0 where id='p1';update variants set stock=0,price=1 where product_id='p1';update payment_settings set provider='iyzico',mode='live',enabled=true;`,
    );
    const input = {
      customer_name: "Demo Test",
      email: "forged@example.test",
      phone: "05000000000",
      address: "Only a private test address",
      note: "",
      consent: true,
      locale: "tr",
      total: 1,
      discount_percent: 100,
      lines: [{ productId: "p1", variantId: "p1-gloss", quantity: 2 }],
    };
    await db.exec("set role anon");
    await assert.rejects(
      db.query("select create_order_request($1::jsonb)", [
        JSON.stringify(input),
      ]),
    );
    await db.exec(
      `set role authenticated;set request.jwt.claim.sub='${member}'`,
    );
    await assert.rejects(
      db.query("select create_order_request($1::jsonb)", [
        JSON.stringify({
          ...input,
          lines: [{ ...input.lines[0], variantId: "p1-matte" }],
        }),
      ]),
      /INVALID_VARIANT/,
    );
    const receipt = (
      await db.query<{ r: { reference: string; total: number } }>(
        "select create_order_request($1::jsonb) r",
        [JSON.stringify(input)],
      )
    ).rows[0].r;
    assert.equal(receipt.total, 1750);
    await db.exec("set role service_role");
    const prepared = (
      await db.query<{
        a: { id: string; reserved: boolean; amount_minor: number };
      }>("select prepare_payment($1,$2::uuid,'iyzico','live') a", [
        receipt.reference,
        member,
      ])
    ).rows[0].a;
    assert.equal(prepared.reserved, false);
    assert.equal(prepared.amount_minor, 175000);
    assert.equal(
      (
        await db.query<{ stock: number }>(
          "select stock from products where id='p1'",
        )
      ).rows[0].stock,
      0,
    );
    const settle = () =>
      db.query<{ state: string }>(
        "select settle_payment($1::uuid,true,175000,'TRY','test-transaction',false) state",
        [prepared.id],
      );
    assert.equal((await settle()).rows[0].state, "paid");
    assert.equal((await settle()).rows[0].state, "paid");
    await db.exec(
      `set role authenticated;set request.jwt.claim.sub='${member}'`,
    );
    const late = (
      await db.query<{ r: { reference: string } }>(
        "select create_order_request($1::jsonb) r",
        [JSON.stringify(input)],
      )
    ).rows[0].r;
    await db.exec("set role service_role");
    const attempt = (
      await db.query<{ a: { id: string } }>(
        "select prepare_payment($1,$2::uuid,'iyzico','live') a",
        [late.reference, member],
      )
    ).rows[0].a;
    await db.exec(
      `update payment_attempts set expires_at=now()-interval '1 minute' where id='${attempt.id}'`,
    );
    await db.query("select expire_payment_attempts()");
    assert.equal(
      (
        await db.query<{ state: string }>(
          "select settle_payment($1::uuid,true,175000,'TRY','late-test',false) state",
          [attempt.id],
        )
      ).rows[0].state,
      "review",
    );
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
