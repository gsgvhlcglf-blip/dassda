import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import {
  shippingState,
  shipmentSchema,
  assertShippable,
  safeShipmentURL,
} from "../src/lib/order-management";
import { seed } from "../src/lib/seed";
import { withBestsellers, visibleBestsellers } from "../src/lib/bestsellers";

test("only a published tracking number changes shipping state; card payment and URL guards remain intact", () => {
  assert.equal(shippingState({}), "preparing");
  assert.equal(shippingState({ tracking_number: "KZ123" }), "preparing");
  assert.equal(
    shippingState({ shipped_at: new Date().toISOString() }),
    "preparing",
  );
  assert.equal(
    shippingState({
      tracking_number: "KZ123",
      shipped_at: new Date().toISOString(),
    }),
    "shipped",
  );
  for (const number of ["", "ab", "javascript:alert(1)", "ABC\n123"])
    assert(
      !shipmentSchema.safeParse({
        tracking_number: number,
        shipping_carrier: "",
        expected_version: 0,
      }).success,
    );
  assert.throws(() =>
    assertShippable({
      status: "confirmed",
      payment_provider: "iyzico",
      payment_status: "pending",
    }),
  );
  assert.throws(() =>
    assertShippable({ status: "cancelled", payment_provider: null }),
  );
  assert.doesNotThrow(() =>
    assertShippable({
      status: "confirmed",
      payment_provider: "iyzico",
      payment_status: "paid",
    }),
  );
  for (const url of [
    "javascript:alert(1)",
    "http://carrier.test/track",
    "https://secret@carrier.test/track",
  ])
    assert.equal(safeShipmentURL(url), undefined);
});
test("missing or inactive homepage curation restores three real published products without rewriting owner selections", () => {
  const c = structuredClone(seed);
  c.content = c.content.filter((row) => row.key !== "home-bestsellers");
  assert.equal(visibleBestsellers(c).productIds.length, 3);
  const curated = withBestsellers(c, {
    productIds: ["p4", "p2"],
    intervalSeconds: 8,
    frames: { p4: { scale: 150, x: 40, y: 60, role: "overview" } },
  });
  assert.deepEqual(visibleBestsellers(curated).productIds, ["p4", "p2"]);
  assert.equal(visibleBestsellers(curated).frames.p4.scale, 150);
  const missing = withBestsellers(c, {
    productIds: ["deleted-product"],
    intervalSeconds: 8,
    frames: {},
  });
  assert.equal(visibleBestsellers(missing).productIds.length, 3);
  assert.deepEqual(
    JSON.parse(
      missing.content.find((row) => row.key === "home-bestsellers")!.body.tr,
    ).productIds,
    ["deleted-product"],
  );
  assert.equal(
    visibleBestsellers(
      withBestsellers(c, {
        productIds: [],
        intervalSeconds: 5,
        hidden: true,
        frames: {},
      }),
    ).hidden,
    true,
  );
});
test("PostgreSQL tracking publication is admin-only, atomic, versioned and never changes payment or price", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      "create role anon;create role authenticated;create function public.is_admin() returns boolean language sql stable as $$select coalesce(current_setting('app.role',true),'')='admin'$$;create table public.orders(id text primary key,status text not null,payment_provider text,payment_status text not null,total numeric not null);insert into public.orders values('paid','confirmed','iyzico','paid',1234),('pending','request_pending','iyzico','pending',1234),('cancelled','cancelled',null,'request_only',1234);",
    );
    await db.exec(
      readFileSync("supabase/migrations/015_order_tracking.sql", "utf8"),
    );
    await db.exec(
      "grant select on public.orders to authenticated;set role anon;",
    );
    const share = (id: string, number: string, version: number, url = "") =>
      db.query("select public.share_order_tracking($1,$2,'',$3,$4)", [
        id,
        number,
        url,
        version,
      ]);
    await assert.rejects(share("paid", "TRACK123", 0), /permission denied/);
    await db.exec("reset role;set role authenticated;set app.role='customer';");
    await assert.rejects(share("paid", "TRACK123", 0), /ADMIN_REQUIRED/);
    await db.exec("set app.role='admin';");
    await assert.rejects(share("pending", "TRACK123", 0), /PAYMENT_NOT_PAID/);
    await assert.rejects(share("cancelled", "TRACK123", 0), /ORDER_CANCELLED/);
    await assert.rejects(
      share("paid", "TRACK123", 0, "javascript:alert(1)"),
      /INVALID_TRACKING_URL/,
    );
    await share("paid", "TRACK123", 0);
    const first = (
      await db.query("select * from public.orders where id='paid'")
    ).rows[0] as Record<string, unknown>;
    assert.equal(first.tracking_number, "TRACK123");
    assert.equal(first.fulfillment_version, 1);
    assert.equal(first.payment_status, "paid");
    assert.equal(Number(first.total), 1234);
    await assert.rejects(share("paid", "STALE123", 0), /ORDER_CONFLICT/);
    await share("paid", "CORRECT123", 1);
    const updated = (
      await db.query("select * from public.orders where id='paid'")
    ).rows[0] as Record<string, unknown>;
    assert.equal(String(updated.shipped_at), String(first.shipped_at));
    assert.equal(updated.tracking_number, "CORRECT123");
    await assert.rejects(
      db.exec(
        "update public.orders set tracking_number='BYPASS123' where id='paid'",
      ),
      /permission denied/,
    );
  } finally {
    await db.close();
  }
});
