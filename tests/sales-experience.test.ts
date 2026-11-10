import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { seed } from "../src/lib/seed";
import { selectedFitment } from "../src/lib/selected-fitment";
import {
  analyticsEventSchema,
  analyticsPath,
  summarizeAnalytics,
  type StoredAnalyticsEvent,
} from "../src/lib/analytics";
import { summarizePurchase } from "../src/lib/purchase-funnel";
import {
  orderEmail,
  deliverOrderEmail,
  type NoticeJob,
} from "../src/lib/order-emails";
import { validateDesign } from "../quick-panel/design.mjs";

test("product decisions use stored model generations and never extend partial compatibility", () => {
  const c = structuredClone(seed),
    query = { brand: "yamaha", model: "yamaha-mt-25", range: "2022-2026" };
  assert.equal(selectedFitment(c, "p1", query)?.status, "full");
  c.compatibility.find(
    (f) => f.product_id === "p1" && f.model_id === query.model,
  )!.year_to = 2024;
  const partial = selectedFitment(c, "p1", query)!;
  assert.equal(partial.status, "partial");
  assert.equal(partial.years, "2022–2024");
  assert.equal(
    selectedFitment(c, "p1", { ...query, range: "", year: "2025" })?.status,
    "none",
  );
  assert.equal(selectedFitment(c, "p1", { ...query, brand: "bmw" }), null);
  assert.equal(
    selectedFitment(c, "p1", { ...query, range: "2010-2099" }),
    null,
  );
  assert.equal(
    selectedFitment(c, "p1", {}, "/motosikletler/yamaha/mt-25/2024")?.status,
    "full",
  );
  const design = validateDesign({
    texts: {},
    images: {},
    photoFrames: {
      "image:img-p1": { scale: 110, x: 50, y: 50, role: "installed" },
      "image:detail": { scale: 100, x: 50, y: 50, role: "mounting" },
    },
  });
  assert.equal(design.photoFrames["image:img-p1"].role, "installed");
});

test("purchase funnel includes direct product entries, ordered stages and no checkout form telemetry", () => {
  const session = randomUUID(),
    now = Date.now();
  const event = (
    kind: StoredAnalyticsEvent["kind"],
    i: number,
    session_id = session,
  ): StoredAnalyticsEvent => ({
    id: randomUUID(),
    session_id,
    kind,
    path: kind === "checkout_start" ? "/odeme" : "/urunler/karbon-on-camurluk",
    viewport_width: 390,
    viewport_height: 844,
    document_width: 390,
    document_height: 2500,
    x: null,
    y: null,
    depth: null,
    referrer_host: "",
    revision: "test",
    created_at: new Date(now - 10000 + i * 1000).toISOString(),
  });
  const rows = [
    event("pageview", 0),
    event("cart_add", 1),
    event("checkout_start", 2),
    event("checkout_start", 3),
    event("pageview", 4, randomUUID()),
  ];
  const report = summarizePurchase(rows);
  assert.deepEqual(report.counts, [2, 1, 1]);
  assert.deepEqual(report.byDevice[0].counts, [2, 1, 1]);
  assert.deepEqual(
    summarizePurchase([
      event("checkout_start", 0),
      event("pageview", 1),
      event("cart_add", 2),
    ]).counts,
    [1, 1, 0],
  );
  const { created_at, ...step } = rows[2];
  assert(analyticsEventSchema.safeParse(step).success);
  for (const patch of [
    { kind: "click", x: 0.1, y: 0.2 },
    { email: "private@example.test" },
    { depth: 0.5 },
    { referrer_host: "private.example" },
    { path: "/odeme?email=private@example.test" },
    { kind: "payment_success" },
  ])
    assert(!analyticsEventSchema.safeParse({ ...step, ...patch }).success);
  assert.equal(analyticsPath("/odeme"), null);
  assert(
    !summarizeAnalytics(rows, 7, now).pages.some((p) => p.path === "/odeme"),
  );
});

test("transactional email is paid-only, escaped HTML/text, retry-idempotent and uses only actual tracking links", async () => {
  const job = {
    id: "confirmation-order",
    order_id: "order",
    kind: "order_confirmed",
    version: 0,
    status: "sending",
    attempts: 1,
    created_at: new Date().toISOString(),
    first_attempt_at: null,
    sent_at: null,
    error: null,
    lease_token: randomUUID(),
    order: {
      id: "order",
      reference: "#1011261",
      customer_name: "Test Customer",
      email: "test@example.test",
      address: "Test address 10",
      phone: "05000000000",
      note: "",
      status: "confirmed",
      total: 100,
      currency: "TRY",
      demo: false,
      created_at: new Date().toISOString(),
      payment_status: "paid",
      items: [
        {
          id: "line",
          order_id: "order",
          product_id: "p1",
          variant_id: "p1-gloss",
          title: "Test product <script>",
          sku: "TEST-G",
          quantity: 1,
          unit_price: 100,
        },
      ],
    },
  } as NoticeJob;
  const mail = orderEmail(job);
  assert(mail.text.includes("#1011261"));
  assert(mail.text.includes("Test product <script>"));
  assert(mail.html.includes("Test product &lt;script&gt;"));
  assert(!mail.html.includes("Test product <script>"));
  assert.throws(
    () => orderEmail({ ...job, order: { ...job.order, demo: true } }),
    /NOT_ELIGIBLE/,
  );
  assert.throws(
    () =>
      orderEmail({
        ...job,
        order: { ...job.order, payment_status: "pending" },
      }),
    /NOT_ELIGIBLE/,
  );
  const requests: RequestInit[] = [];
  const transport = async (_url: unknown, options?: RequestInit) => {
    requests.push(options!);
    return Response.json({ id: "fixture-provider-id" });
  };
  await deliverOrderEmail(
    job,
    { key: "TEST-ONLY", from: "shop@example.test" },
    transport as typeof fetch,
  );
  await deliverOrderEmail(
    job,
    { key: "TEST-ONLY", from: "shop@example.test" },
    transport as typeof fetch,
  );
  assert.equal(
    new Headers(requests[0].headers).get("Idempotency-Key"),
    new Headers(requests[1].headers).get("Idempotency-Key"),
  );
  await assert.rejects(
    deliverOrderEmail(
      job,
      { key: "TEST-ONLY", from: "shop@example.test" },
      (async () =>
        new Response("private-provider-error", {
          status: 500,
        })) as typeof fetch,
    ),
    /EMAIL_TEMPORARY_FAILURE/,
  );
  const shipped = {
    ...job,
    kind: "shipment_shared",
    version: 2,
    order: {
      ...job.order,
      fulfillment_version: 2,
      tracking_number: "TRACK-123",
      shipped_at: new Date().toISOString(),
      tracking_url: "javascript:alert(1)",
    },
  } as NoticeJob;
  assert(!orderEmail(shipped).text.includes("javascript:"));
  assert.throws(() => orderEmail({ ...shipped, version: 1 }), /SUPERSEDED/);
});
