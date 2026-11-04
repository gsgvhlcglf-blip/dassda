import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { seed } from "../src/lib/seed";
import { validateCatalog, editCatalog } from "../src/lib/site-version";
import { validateDesign } from "../quick-panel/design.mjs";
import { summarizeFunnel } from "../src/lib/analytics-funnel";
import type { StoredAnalyticsEvent } from "../src/lib/analytics";
test("catalog drafts preserve relationships and photo settings validate safe ranges", () => {
  assert.equal(validateCatalog(seed).brands.length, 3);
  const edited = editCatalog(seed, "products", "update", {
    ...seed.products[0],
    title: { tr: "Draft title", en: "", ru: "" },
  });
  assert.equal(edited.products[0].title.tr, "Draft title");
  assert.notEqual(seed.products[0].title.tr, "Draft title");
  assert.throws(() =>
    editCatalog(seed, "categories", "delete", seed.categories[0]),
  );
  assert.throws(() =>
    validateDesign({
      texts: {},
      images: {},
      photography: {
        aspect: "square",
        background: "dark",
        fit: "contain",
        scale: 999,
      },
    }),
  );
  const design = validateDesign({
    texts: {},
    images: {},
    photoFrames: {
      "image:p1-img": { scale: 120, x: 50, y: 30, role: "texture" },
    },
  });
  assert.equal(design.photoFrames["image:p1-img"].role, "texture");
});
const event = (
  path: string,
  session_id: string,
  kind: StoredAnalyticsEvent["kind"] = "pageview",
  width = 390,
): StoredAnalyticsEvent => ({
  id: randomUUID(),
  session_id,
  kind,
  path,
  viewport_width: width,
  viewport_height: 844,
  document_width: width,
  document_height: 3000,
  x: null,
  y: null,
  depth: null,
  referrer_host: "",
  revision: "test",
  created_at: new Date().toISOString(),
});
test("ordered funnel distinguishes direct entrants, devices, incomplete journeys and successful cart additions", () => {
  const a = randomUUID(),
    b = randomUUID(),
    c = randomUUID();
  const paths = [
    "/motosikletler",
    "/motosikletler/yamaha",
    "/motosikletler/yamaha/mt-25",
    "/motosikletler/yamaha/mt-25/2024",
    "/urunler/karbon-on-camurluk",
  ];
  const rows = [
    ...paths.map((p) => event(p, a)),
    event(paths[4], a, "cart_add"),
    event(paths[0], b, "pageview", 1440),
    event(paths[4], b, "pageview", 1440),
    event(paths[4], c),
  ];
  const result = summarizeFunnel(rows);
  assert.deepEqual(result.counts, [2, 1, 1, 1, 1, 1]);
  assert.deepEqual(
    result.byDevice.find((d) => d.device === "Mobil")?.counts,
    [1, 1, 1, 1, 1, 1],
  );
  assert.deepEqual(
    result.byDevice.find((d) => d.device === "Masaüstü")?.counts,
    [1, 0, 0, 0, 0, 0],
  );
  assert.equal(result.directProductSessions, 1);
});
test("PostgreSQL draft/save/publish/restore is atomic, private, preserves inventory and supports funnel reports", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;alter default privileges in schema public grant select,insert,update,delete on tables to anon,authenticated;`,
    );
    await db.exec(readFileSync("supabase/migrations/001_store.sql", "utf8"));
    await db.exec(readFileSync("supabase/seed.sql", "utf8"));
    for (const file of [
      "003_analytics.sql",
      "004_analytics_funnel.sql",
      "005_site_versions.sql",
    ])
      await db.exec(readFileSync("supabase/migrations/" + file, "utf8"));
    await db.exec(
      `insert into auth.users values('00000000-0000-0000-0000-000000000001'),('00000000-0000-0000-0000-000000000002');insert into public.admin_users values('00000000-0000-0000-0000-000000000001','admin'),('00000000-0000-0000-0000-000000000002','editor');set role authenticated;set request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';`,
    );
    const workspace = async () =>
      (
        await db.query<{
          w: {
            revision: number;
            catalog: typeof seed;
            published_id: string | null;
            history: { id: string; label: string }[];
          };
        }>("select public.get_site_workspace() as w")
      ).rows[0].w;
    const before = await workspace(),
      draft = structuredClone(before.catalog),
      original = draft.products[0].title.tr;
    draft.products[0].title.tr = "Unpublished title";
    await db.query(
      "select public.save_site_workspace($1,$2::jsonb,$3::jsonb)",
      [
        before.revision,
        JSON.stringify(draft),
        JSON.stringify({
          texts: {},
          images: {},
          photography: {
            aspect: "square",
            background: "light",
            fit: "contain",
            scale: 90,
          },
        }),
      ],
    );
    await db.exec("set role anon");
    assert.equal(
      (
        await db.query<{ title: { tr: string } }>(
          "select title from public.products where id='p1'",
        )
      ).rows[0].title.tr,
      original,
    );
    assert.equal(
      (await db.query("select * from public.site_workspace")).rows.length,
      0,
    );
    assert.equal(
      (await db.query("select * from public.site_versions")).rows.length,
      0,
    );
    await db.exec(
      "set role authenticated;set request.jwt.claim.sub='00000000-0000-0000-0000-000000000002'",
    );
    await assert.rejects(
      db.exec("update public.products set price=1"),
      /permission denied/,
    );
    await assert.rejects(
      db.query("select public.publish_site_workspace(2)"),
      /FORBIDDEN/,
    );
    await db.exec(
      "set request.jwt.claim.sub='00000000-0000-0000-0000-000000000001'",
    );
    await assert.rejects(
      db.query("select public.publish_site_workspace(1)"),
      /WORKSPACE_CONFLICT/,
    );
    await db.query("select public.publish_site_workspace(2)");
    assert.equal(
      (
        await db.query<{ title: { tr: string } }>(
          "select title from public.products where id='p1'",
        )
      ).rows[0].title.tr,
      "Unpublished title",
    );
    const published = await workspace(),
      baseline = published.history.find((v) => v.label === "İlk yayın öncesi")!;
    assert(baseline);
    await db.exec(
      "reset role;update public.products set stock=3 where id='p1';set role authenticated",
    );
    await db.query("select public.publish_site_workspace($1,$2::uuid)", [
      published.revision,
      baseline.id,
    ]);
    assert.equal(
      (
        await db.query<{ stock: number; title: { tr: string } }>(
          "select stock,title from public.products where id='p1'",
        )
      ).rows[0].stock,
      3,
    );
    assert.equal(
      (
        await db.query<{ title: { tr: string } }>(
          "select title from public.products where id='p1'",
        )
      ).rows[0].title.tr,
      original,
    );
    assert(
      (await workspace()).history.some(
        (v) => v.label === "Geri almadan önceki taslak",
      ),
    );
    await db.exec("update public.analytics_settings set enabled=true");
    const sid = randomUUID(),
      paths = [
        "/motosikletler",
        "/motosikletler/yamaha",
        "/motosikletler/yamaha/mt-25",
        "/motosikletler/yamaha/mt-25/2024",
        "/urunler/karbon-on-camurluk",
      ];
    const events = [
      ...paths.map((p) => event(p, sid)),
      event(paths[4], sid, "cart_add"),
    ].map(({ created_at, ...e }) => e);
    await db.query("select public.append_analytics_events($1::jsonb)", [
      JSON.stringify({ consent: true, events }),
    ]);
    const funnel = await db.query<{ f: { counts: number[] } }>(
      "select public.admin_analytics_funnel(7) as f",
    );
    assert.deepEqual(funnel.rows[0].f.counts, [1, 1, 1, 1, 1, 1]);
    await db.exec("set role anon");
    await assert.rejects(
      db.query("select public.admin_analytics_funnel(7)"),
      /permission denied/,
    );
  } finally {
    await db.close();
  }
});
