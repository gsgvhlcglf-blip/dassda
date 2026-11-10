import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

test("guest orders and payments preserve pricing, daily references, isolation and private RPC access", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
      create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;
      create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;
      alter default privileges in schema public grant select,insert,update,delete on tables to anon,authenticated;`);
    for (const file of [
      "001_store",
      "002_customer_membership",
      "006_payments",
      "013_product_commerce",
      "016_daily_order_references",
      "017_guest_checkout",
    ])
      await db.exec(readFileSync(`supabase/migrations/${file}.sql`, "utf8"));
    await db.exec(readFileSync("supabase/seed.sql", "utf8"));
    const key = "a".repeat(64),
      other = "b".repeat(64);
    const input = {
      customer_name: "Guest Buyer",
      email: "guest@example.test",
      phone: "05000000000",
      address: "Private test street 10",
      note: "",
      consent: true,
      locale: "tr",
      total: 1,
      lines: [{ productId: "p1", variantId: "p1-gloss", quantity: 2 }],
    };
    await db.exec(
      "update public.products set discount_percent=10 where id='p1';update public.payment_settings set provider='iyzico',mode='test',enabled=true where id='site';set role anon;",
    );
    await assert.rejects(
      db.query("select public.create_guest_order_request($1::jsonb,$2)", [
        JSON.stringify(input),
        key,
      ]),
      /permission denied/,
    );
    await db.exec("set role authenticated");
    await assert.rejects(
      db.query("select public.create_guest_order_request($1::jsonb,$2)", [
        JSON.stringify(input),
        key,
      ]),
      /permission denied/,
    );
    await assert.rejects(
      db.query("select public.create_order_request($1::jsonb)", [
        JSON.stringify(input),
      ]),
      /permission denied/,
    );
    await db.exec("set role service_role");
    const create = async (data: typeof input, session = key) =>
      (
        await db.query<{ result: { reference: string; total: number } }>(
          "select public.create_guest_order_request($1::jsonb,$2) result",
          [JSON.stringify(data), session],
        )
      ).rows[0].result;
    await assert.rejects(create(input, "invalid"), /AUTH_REQUIRED/);
    const order = await create(input);
    assert.match(order.reference, /^#[0-9]{6}1$/);
    assert.equal(order.total, 12330);
    await assert.rejects(
      create({ ...input, consent: false }),
      /Invalid request/,
    );
    const second = await create(input, other);
    assert.match(second.reference, /^#[0-9]{6}2$/);
    const prepare = async (session: string) =>
      (
        await db.query<{
          a: {
            id: string;
            customer_id: string | null;
            amount_minor: number;
            created: boolean;
          };
        }>("select public.prepare_guest_payment($1,$2,'iyzico','test') a", [
          order.reference,
          session,
        ])
      ).rows[0].a;
    await assert.rejects(prepare(other), /AUTH_REQUIRED/);
    const payment = await prepare(key);
    assert.equal(payment.customer_id, null);
    assert.equal(payment.amount_minor, 1233000);
    assert.equal(payment.created, true);
    assert.equal((await prepare(key)).id, payment.id);
    assert.equal((await prepare(key)).created, false);
    await db.exec("set role anon");
    assert.equal(
      (await db.query("select * from public.orders")).rows.length,
      0,
    );
    assert.equal(
      (await db.query("select * from public.order_items")).rows.length,
      0,
    );
    await assert.rejects(prepare(key), /permission denied/);
    await db.exec("reset role");
    assert.equal((await db.query("select * from auth.users")).rows.length, 0);
    assert.equal(
      (
        await db.query(
          "select * from public.orders where customer_id is null and guest_key is not null",
        )
      ).rows.length,
      2,
    );
  } finally {
    await db.close();
  }
});
