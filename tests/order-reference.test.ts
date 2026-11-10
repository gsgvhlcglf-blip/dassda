import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import {
  orderReferenceDay,
  formatOrderReference,
  dailyOrderCounters,
} from "../src/lib/order-reference";

test("daily order references follow the requested format and Istanbul midnight/year boundaries", () => {
  const date = new Date("2026-11-10T09:00:00Z");
  assert.equal(formatOrderReference(1, date), "#1011261");
  assert.equal(formatOrderReference(2, date), "#1011262");
  assert.equal(formatOrderReference(10, date), "#10112610");
  assert.equal(
    formatOrderReference(1, new Date("2026-11-09T21:00:00Z")),
    "#1011261",
  );
  assert.equal(
    orderReferenceDay(new Date("2026-11-10T20:59:59Z")).day,
    "2026-11-10",
  );
  assert.equal(
    formatOrderReference(1, new Date("2026-11-10T21:00:00Z")),
    "#1111261",
  );
  assert.equal(
    formatOrderReference(1, new Date("2026-12-31T21:00:00Z")),
    "#0101271",
  );
  for (const invalid of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])
    assert.throws(() => formatOrderReference(invalid, date));
});
test("counter migration includes legacy orders and the largest existing suffix without renumbering them", () => {
  const rows = [
    { reference: "KZ-OLD", created_at: "2026-11-10T09:00:00Z" },
    { reference: "#1011269", created_at: "2026-11-10T10:00:00Z" },
    { reference: "KZ-OLDER", created_at: "2026-11-09T21:00:00Z" },
    { reference: "#1111263", created_at: "2026-11-10T21:00:00Z" },
  ];
  const original = structuredClone(rows),
    counters = dailyOrderCounters(rows);
  assert.equal(counters.get("2026-11-10"), 9);
  assert.equal(counters.get("2026-11-11"), 3);
  assert.deepEqual(rows, original);
});
test("PostgreSQL counters are private, transactional, persistent and reset only at Istanbul midnight", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      "create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create table public.orders(id text primary key,reference text unique not null,created_at timestamptz not null,customer_id uuid);insert into public.orders values('legacy','KZ-LEGACY','2026-11-10T09:00:00Z',null),('prior','#1011269','2026-11-10T10:00:00Z',null);",
    );
    await db.exec(
      readFileSync(
        "supabase/migrations/016_daily_order_references.sql",
        "utf8",
      ),
    );
    const next = async (at: string) =>
      (
        await db.query<{ ref: string }>(
          "select public.next_order_reference($1::timestamptz) as ref",
          [at],
        )
      ).rows[0].ref;
    assert.equal(await next("2026-11-10T12:00:00Z"), "#10112610");
    await db.exec("begin");
    assert.equal(await next("2026-11-10T12:00:00Z"), "#10112611");
    await db.exec("rollback");
    assert.equal(await next("2026-11-10T20:59:59Z"), "#10112611");
    assert.equal(await next("2026-11-10T21:00:00Z"), "#1111261");
    assert.equal(await next("2026-11-10T22:00:00Z"), "#1111262");
    assert.equal(
      (
        await db.query<{ reference: string }>(
          "select reference from public.orders where id='legacy'",
        )
      ).rows[0].reference,
      "KZ-LEGACY",
    );
    await db.exec("set role authenticated");
    await assert.rejects(next("2026-11-10T22:00:00Z"), /permission denied/);
    await assert.rejects(
      db.exec("select * from public.order_daily_counters"),
      /permission denied/,
    );
    await db.exec("reset role;set role anon");
    await assert.rejects(
      db.exec("select public.create_order_request('{}'::jsonb)"),
      /permission denied/,
    );
  } finally {
    await db.close();
  }
});
