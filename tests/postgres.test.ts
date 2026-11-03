import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
test("PostgreSQL migration, demo seed, RLS roles and authoritative order RPC", async () => {
  const db = new PGlite();
  await db.exec(
    `create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$; grant usage on schema auth to anon,authenticated; grant execute on function auth.uid() to anon,authenticated; create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]); create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text); alter table storage.objects enable row level security; alter default privileges in schema public grant select,insert,update,delete on tables to anon,authenticated;`,
  );
  await db.exec(readFileSync("supabase/migrations/001_store.sql", "utf8"));
  await db.exec(readFileSync("supabase/seed.sql", "utf8"));
  assert.equal((await db.query("select * from public.brands")).rows.length, 3);
  await db.exec(
    `update public.products set published=false where id='p6';set role anon;`,
  );
  assert.equal(
    (await db.query("select * from public.products")).rows.length,
    5,
  );
  await db.exec(`delete from public.products where id='p1'`);
  assert.equal(
    (await db.query("select * from public.products where id='p1'")).rows.length,
    1,
  );
  const input = {
    customer_name: "Test Customer",
    email: "postgres@example.test",
    phone: "05000000000",
    address: "Test street 10, test address",
    note: "",
    consent: true,
    locale: "tr",
    lines: [{ productId: "p1", variantId: "p1-gloss", quantity: 2 }],
    total: 1,
  };
  const result = await db.query<{
    result: { reference: string; total: number; demo: boolean };
  }>("select public.create_order_request($1::jsonb) as result", [
    JSON.stringify(input),
  ]);
  assert.equal(result.rows[0].result.total, 13700);
  assert.equal(result.rows[0].result.demo, true);
  assert.equal((await db.query("select * from public.orders")).rows.length, 0);
  await assert.rejects(
    db.query("select public.create_order_request($1::jsonb)", [
      JSON.stringify({
        ...input,
        lines: [{ productId: "p1", variantId: "p2-gloss", quantity: 1 }],
      }),
    ]),
    /OUT_OF_STOCK/,
  );
  await assert.rejects(
    db.query("select public.create_order_request($1::jsonb)", [
      JSON.stringify({ ...input, consent: false }),
    ]),
    /Invalid request/,
  );
  await db.exec(
    `reset role;insert into auth.users values('00000000-0000-0000-0000-000000000001'),('00000000-0000-0000-0000-000000000002');insert into public.admin_users values('00000000-0000-0000-0000-000000000001','admin'),('00000000-0000-0000-0000-000000000002','editor');set role authenticated;set request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';`,
  );
  assert.equal((await db.query("select * from public.orders")).rows.length, 0);
  assert.equal(
    (await db.query("select * from public.products")).rows.length,
    6,
  );
  await assert.rejects(
    db.exec(
      `insert into public.admin_users values('00000000-0000-0000-0000-000000000002','admin')`,
    ),
    /row-level security|permission denied/,
  );
  await db.exec(
    `set request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';`,
  );
  assert.equal((await db.query("select * from public.orders")).rows.length, 1);
  await db.exec(`update public.orders set status='reviewing'`);
  await assert.rejects(
    db.exec(`update public.orders set total=1`),
    /permission denied/,
  );
  await assert.rejects(
    db.exec(
      `insert into public.model_years values('bad-year','yamaha-mt-25','bmw-s1000rr-demo',2024)`,
    ),
    /Generation must belong/,
  );
  await assert.rejects(
    db.exec(
      `update public.generations set end_year=2023 where id='yamaha-mt-25-demo'`,
    ),
    /outside this generation/,
  );
  // The membership migration must close both HTTP and direct anonymous RPC paths.
  await db.exec(
    `reset role;alter table auth.users add column email text;alter table auth.users add column email_confirmed_at timestamptz;insert into auth.users(id,email) values('00000000-0000-0000-0000-000000000003','member@example.test'),('00000000-0000-0000-0000-000000000004','other@example.test');`,
  );
  await db.exec(
    readFileSync("supabase/migrations/002_customer_membership.sql", "utf8"),
  );
  await db.exec("set role anon;set request.jwt.claim.sub='';");
  await assert.rejects(
    db.query("select public.create_order_request($1::jsonb)", [
      JSON.stringify(input),
    ]),
    /permission denied/,
  );
  await assert.rejects(
    db.query("select public.create_order_request_internal($1::jsonb)", [
      JSON.stringify(input),
    ]),
    /permission denied/,
  );
  await db.exec(
    "set role authenticated;set request.jwt.claim.sub='00000000-0000-0000-0000-000000000003';",
  );
  await assert.rejects(
    db.query("select public.create_order_request($1::jsonb)", [
      JSON.stringify(input),
    ]),
    /AUTH_REQUIRED/,
  );
  await db.exec(
    "reset role;update auth.users set email_confirmed_at=now();set role authenticated;set request.jwt.claim.sub='00000000-0000-0000-0000-000000000003';",
  );
  const own = await db.query<{ result: { reference: string } }>(
    "select public.create_order_request($1::jsonb) as result",
    [JSON.stringify({ ...input, email: "forged@example.test" })],
  );
  const ownOrders = await db.query<{ email: string; customer_id: string }>(
    "select * from public.orders",
  );
  assert.equal(ownOrders.rows.length, 1);
  assert.equal(ownOrders.rows[0].email, "member@example.test");
  assert.equal(
    (await db.query("select * from public.order_items")).rows.length,
    1,
  );
  await assert.rejects(
    db.exec(
      "update public.orders set customer_id='00000000-0000-0000-0000-000000000004'",
    ),
    /permission denied/,
  );
  await db.exec(
    "set request.jwt.claim.sub='00000000-0000-0000-0000-000000000004';",
  );
  assert.equal((await db.query("select * from public.orders")).rows.length, 0);
  assert.equal(
    (await db.query("select * from public.order_items")).rows.length,
    0,
  );
  assert.match(own.rows[0].result.reference, /^KZ-/);
  await db.close();
});
