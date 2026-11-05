import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { seed } from "../src/lib/seed";
import { publicCatalog } from "../src/lib/catalog-visibility";
import { compatibleProducts } from "../src/lib/commerce";
import { validateCatalog } from "../src/lib/site-version";

test("hidden models and products retain editable data; shared products and old drafts survive", () => {
  const catalog = structuredClone(seed);
  const original = structuredClone(catalog);
  const model = catalog.models.find((m) => m.id === "yamaha-mt-25")!;
  model.published = false;
  catalog.products[0].published = false;
  const view = publicCatalog(catalog);
  assert(!view.models.some((m) => m.id === model.id));
  assert(!view.model_years.some((y) => y.model_id === model.id));
  assert(!view.generations.some((g) => g.model_id === model.id));
  assert(
    !view.compatibility.some(
      (f) => f.model_id === model.id || f.product_id === "p1",
    ),
  );
  assert(!view.variants.some((v) => v.product_id === "p1"));
  assert(!view.product_images.some((i) => i.product_id === "p1"));
  assert.deepEqual(compatibleProducts(catalog, model.id, 2024), []);
  assert(view.products.some((p) => p.id === "p2"));
  assert(
    compatibleProducts(view, "yamaha-mt-09", 2024).some((p) => p.id === "p2"),
  );
  assert.deepEqual(catalog.model_years, original.model_years);
  assert.deepEqual(catalog.compatibility, original.compatibility);
  assert.deepEqual(catalog.product_images, original.product_images);
  const legacy = structuredClone(original) as unknown as {
    models: Record<string, unknown>[];
  };
  for (const m of legacy.models) delete m.published;
  const restored = validateCatalog(legacy);
  assert(restored.models.every((m) => m.published));
  assert.equal(publicCatalog(restored).models.length, original.models.length);
  model.published = true;
  catalog.products[0].published = true;
  assert.deepEqual(publicCatalog(catalog), original);
});

test("PostgreSQL publication protects hidden models and relations through RLS and restores legacy versions", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;alter default privileges in schema public grant select,insert,update,delete on tables to anon,authenticated;`,
    );
    for (const file of [
      "001_store.sql",
      "005_site_versions.sql",
      "007_model_visibility.sql",
    ])
      await db.exec(readFileSync("supabase/migrations/" + file, "utf8"));
    await db.exec(readFileSync("supabase/seed.sql", "utf8"));
    const login = `set role authenticated;set request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';`;
    await db.exec(
      `insert into auth.users values('00000000-0000-0000-0000-000000000001');insert into public.admin_users values('00000000-0000-0000-0000-000000000001','admin');${login}`,
    );
    const workspace = async () =>
      (
        await db.query<{ w: { revision: number; catalog: typeof seed } }>(
          "select public.get_site_workspace() w",
        )
      ).rows[0].w;
    const before = await workspace();
    before.catalog.models.find((m) => m.id === "yamaha-mt-25")!.published =
      false;
    before.catalog.products.find((p) => p.id === "p1")!.published = false;
    const revision = (
      await db.query<{ r: number }>(
        "select public.save_site_workspace($1,$2::jsonb,'{}'::jsonb) r",
        [before.revision, JSON.stringify(before.catalog)],
      )
    ).rows[0].r;
    // Saving a private draft does not change the currently published model.
    assert(
      (
        await db.query<{ published: boolean }>(
          "select published from public.models where id='yamaha-mt-25'",
        )
      ).rows[0].published,
    );
    await db.query("select public.publish_site_workspace($1)", [revision]);
    assert.equal(
      (await db.query("select * from public.models")).rows.length,
      seed.models.length,
    );
    assert.equal(
      (await db.query("select * from public.products")).rows.length,
      seed.products.length,
    );
    await db.exec("reset role;set role anon;set request.jwt.claim.sub='';");
    for (const table of [
      "models",
      "generations",
      "model_years",
      "compatibility",
    ])
      assert.equal(
        (
          await db.query(
            `select * from public.${table} where ${table === "models" ? "id" : "model_id"}='yamaha-mt-25'`,
          )
        ).rows.length,
        0,
      );
    for (const table of [
      "products",
      "variants",
      "product_images",
      "compatibility",
    ])
      assert.equal(
        (
          await db.query(
            `select * from public.${table} where ${table === "products" ? "id" : "product_id"}='p1'`,
          )
        ).rows.length,
        0,
      );
    assert.equal(
      (await db.query("select * from public.products where id='p2'")).rows
        .length,
      1,
    );
    assert(
      (
        await db.query(
          "select * from public.compatibility where model_id='yamaha-mt-09' and product_id='p2'",
        )
      ).rows.length > 0,
    );
    // Simulate a pre-upgrade saved version whose model records lack the new flag.
    await db.exec(
      `reset role;update public.site_versions set catalog=jsonb_set(catalog,'{models}',(select jsonb_agg(m-'published') from jsonb_array_elements(catalog->'models') m)) where label='İlk yayın öncesi';${login}`,
    );
    const current = await workspace();
    const baseline = (
      await db.query<{ id: string }>(
        "select id from public.site_versions where label='İlk yayın öncesi'",
      )
    ).rows[0].id;
    await db.query("select public.publish_site_workspace($1,$2::uuid)", [
      current.revision,
      baseline,
    ]);
    await db.exec("reset role;set role anon;set request.jwt.claim.sub='';");
    assert.equal(
      (await db.query("select * from public.models")).rows.length,
      seed.models.length,
    );
    assert.equal(
      (await db.query("select * from public.products")).rows.length,
      seed.products.length,
    );
    assert.equal(
      (await db.query("select * from public.model_years")).rows.length,
      seed.model_years.length,
    );
    assert.equal(
      (await db.query("select * from public.compatibility")).rows.length,
      seed.compatibility.length,
    );
  } finally {
    await db.close();
  }
});
