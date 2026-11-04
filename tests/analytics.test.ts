import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import {
  analyticsPath,
  analyticsEventSchema,
  analyticsHeatmap,
  summarizeAnalytics,
  dayKey,
  type StoredAnalyticsEvent,
} from "../src/lib/analytics";
const session = randomUUID();
const event = (
  overrides: Partial<StoredAnalyticsEvent> = {},
): StoredAnalyticsEvent => ({
  id: randomUUID(),
  session_id: session,
  kind: "pageview",
  path: "/",
  viewport_width: 1280,
  viewport_height: 900,
  document_width: 1280,
  document_height: 3000,
  x: null,
  y: null,
  depth: 0.3,
  referrer_host: "",
  revision: "test1",
  created_at: new Date().toISOString(),
  ...overrides,
});
test("only public routes and allowlisted anonymous fields enter analytics", () => {
  assert.equal(
    analyticsPath("/urunler?email=private@example.test"),
    "/urunler",
  );
  for (const path of [
    "/admin",
    "/admin/ayarlar",
    "/odeme",
    "/hesabim",
    "/giris",
    "/sepet",
    "/auth/callback",
  ])
    assert.equal(analyticsPath(path), null);
  const { created_at, ...valid } = event();
  assert(analyticsEventSchema.safeParse(valid).success);
  assert(
    !analyticsEventSchema.safeParse({ ...valid, email: "secret@example.test" })
      .success,
  );
  assert(
    !analyticsEventSchema.safeParse({ ...valid, path: "/urunler?q=secret" })
      .success,
  );
  assert(
    !analyticsEventSchema.safeParse({ ...valid, kind: "click", x: 1.1, y: 0.5 })
      .success,
  );
  assert(!analyticsEventSchema.safeParse({ ...valid, kind: "click" }).success);
  assert(
    !analyticsEventSchema.safeParse({
      ...valid,
      referrer_host: "search.test/?query=secret",
    }).success,
  );
});
test("report groups tab sessions, maximum page depth and exact heatmap screens", () => {
  const rows = [
    event(),
    event({ path: "/urunler" }),
    event({ kind: "scroll", depth: 0.9 }),
    event({ kind: "click", x: 0.2, y: 0.3, depth: null }),
    event({ kind: "click", x: 0.201, y: 0.301, depth: null }),
    event({
      kind: "click",
      x: 1,
      y: 1,
      viewport_width: 390,
      revision: "test2",
      depth: null,
    }),
    event({ created_at: "2000-01-01T00:00:00Z" }),
    event({ created_at: "2100-01-01T00:00:00Z" }),
  ];
  const result = summarizeAnalytics(rows, 7);
  assert.equal(result.totals.sessions, 1);
  assert.equal(result.totals.pageviews, 2);
  assert.equal(result.totals.clicks, 3);
  assert.equal(result.totals.averageDepth, 0.6);
  assert.equal(result.daily.length, 7);
  assert.equal(
    result.daily.reduce((sum, d) => sum + d.views, 0),
    2,
  );
  const heat = analyticsHeatmap(rows, 7, "/", 1280, 900, "test1");
  assert.equal(heat.total, 2);
  assert.equal(heat.points.length, 1);
  assert.equal(heat.points[0].count, 2);
  assert.equal(heat.screens.length, 2);
  assert.equal(dayKey("2026-11-04T22:00:00Z"), "2026-11-05");
});
test("PostgreSQL analytics migration enforces consent, disabled default, RLS and private reports", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      "create role anon;create role authenticated;create function public.is_admin() returns boolean language sql stable as $$select current_setting('app.role',true)='admin'$$;alter default privileges in schema public grant select,insert,update,delete on tables to anon,authenticated;",
    );
    await db.exec(
      readFileSync("supabase/migrations/003_analytics.sql", "utf8"),
    );
    const { created_at, ...valid } = event();
    const collect = (input: unknown) =>
      db.query("select public.append_analytics_events($1::jsonb)", [
        JSON.stringify(input),
      ]);
    await db.exec("set role anon");
    assert.equal(
      (await db.query("select * from public.analytics_events")).rows.length,
      0,
    );
    await assert.rejects(
      collect({ consent: true, events: [valid] }),
      /ANALYTICS_DISABLED/,
    );
    await assert.rejects(
      db.query("select public.admin_analytics_summary(7)"),
      /permission denied/,
    );
    await db.exec(
      "reset role;set app.role='admin';update public.analytics_settings set enabled=true;set role anon;",
    );
    await assert.rejects(
      collect({ consent: false, events: [valid] }),
      /CONSENT_REQUIRED/,
    );
    await assert.rejects(
      collect({ consent: true, events: [{ ...valid, email: "private" }] }),
      /INVALID_EVENTS/,
    );
    await assert.rejects(
      collect({ consent: true, events: [{ ...valid, path: "/odeme" }] }),
      /INVALID_EVENTS/,
    );
    await collect({
      consent: true,
      events: [
        valid,
        valid,
        {
          ...valid,
          id: randomUUID(),
          kind: "click",
          depth: null,
          x: 0.5,
          y: 0.5,
        },
      ],
    });
    assert.equal(
      (await db.query("select * from public.analytics_events")).rows.length,
      0,
    );
    await db.exec("set role authenticated;set app.role='editor'");
    await assert.rejects(
      db.query("select public.admin_analytics_summary(7)"),
      /FORBIDDEN/,
    );
    await db.exec("update public.analytics_settings set enabled=false");
    const flags = await db.query<{ settings: { enabled: boolean } }>(
      "select public.analytics_public_settings() as settings",
    );
    assert.equal(flags.rows[0].settings.enabled, true);
    assert.equal(
      (await db.query("select * from public.analytics_settings")).rows.length,
      0,
    );
    await db.exec("set app.role='admin'");
    const report = await db.query<{
      report: {
        totals: { sessions: number; pageviews: number; clicks: number };
        daily: unknown[];
      };
    }>("select public.admin_analytics_summary(7) as report");
    assert.deepEqual(report.rows[0].report.totals, {
      sessions: 1,
      pageviews: 1,
      clicks: 1,
      averageDepth: 0.3,
    });
    assert.equal(report.rows[0].report.daily.length, 7);
    const heat = await db.query<{ heat: { total: number; points: unknown[] } }>(
      "select public.admin_analytics_heatmap(7,'/',1280,900,'test1') as heat",
    );
    assert.equal(heat.rows[0].heat.total, 1);
    assert.equal(heat.rows[0].heat.points.length, 1);
    await db.exec(
      "reset role;insert into public.analytics_events select gen_random_uuid(),session_id,kind,path,viewport_width,viewport_height,document_width,document_height,x,y,depth,referrer_host,revision,now()-interval '31 days' from public.analytics_events limit 1;set role authenticated;select public.admin_analytics_summary(90)",
    );
    assert.equal(
      (await db.query("select * from public.analytics_events")).rows.length,
      2,
    );
    await db.query("select public.clear_analytics_events()");
    assert.equal(
      (await db.query("select * from public.analytics_events")).rows.length,
      0,
    );
  } finally {
    await db.close();
  }
});
