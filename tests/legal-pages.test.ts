import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { legalPages, applyLegalPages } from "../src/lib/legal-content";
import { schemas } from "../src/lib/validation";
test("legal pages are editable public content and PostgreSQL migration preserves unrelated data/locales", async () => {
  for (const page of legalPages) {
    assert(schemas.content.safeParse(page).success);
    assert(page.body.tr.includes("(Buraya"));
  }
  const db = new PGlite();
  try {
    await db.exec(
      "CREATE TABLE public.content(id text primary key,key text unique not null,title jsonb not null,body jsonb not null)",
    );
    await db.query("INSERT INTO public.content VALUES ($1,$2,$3,$4)", [
      "privacy",
      "privacy",
      { tr: "Old privacy", en: "Owner title", ru: "Owner title" },
      { tr: "Old body", en: "Owner English", ru: "Owner Russian" },
    ]);
    await db.query("INSERT INTO public.content VALUES ($1,$2,$3,$4)", [
      "home",
      "home",
      { tr: "Owner homepage" },
      { tr: "Owner homepage text" },
    ]);
    await db.exec(
      "CREATE TABLE public.site_workspace(id text primary key,catalog jsonb not null,design jsonb not null,revision bigint not null)",
    );
    const draft = {
      content: [
        {
          id: "privacy",
          key: "privacy",
          title: { tr: "Old", en: "Keep title" },
          body: { tr: "Old body", en: "Keep draft English" },
        },
      ],
      products: [{ id: "owner-product", price: 9876 }],
    };
    await db.query(
      "INSERT INTO public.site_workspace VALUES ('site',$1,$2,5)",
      [draft, { texts: { tr: { "slot:header.brand": "Owner logo" } } }],
    );
    await db.exec(
      readFileSync("supabase/migrations/011_legal_pages.sql", "utf8"),
    );
    const privacy = (
      await db.query<{ body: { tr: string; en: string } }>(
        "SELECT body FROM public.content WHERE key='privacy'",
      )
    ).rows[0];
    assert.equal(
      privacy.body.tr,
      legalPages.find((page) => page.key === "privacy")!.body.tr,
    );
    assert.equal(privacy.body.en, "Owner English");
    const workspace = (
      await db.query<{
        catalog: typeof draft;
        revision: number;
        design: unknown;
      }>("SELECT * FROM public.site_workspace")
    ).rows[0];
    assert.equal(workspace.catalog.content.length, 5);
    assert.equal(
      workspace.catalog.content.find((row) => row.key === "privacy")?.body.en,
      "Keep draft English",
    );
    assert.equal(workspace.catalog.products[0].price, 9876);
    assert.equal(Number(workspace.revision), 6);

    assert.equal(
      (await db.query("SELECT * FROM public.content")).rows.length,
      6,
    );
    assert.equal(
      (
        await db.query<{ body: { tr: string } }>(
          "SELECT body FROM public.content WHERE key='home'",
        )
      ).rows[0].body.tr,
      "Owner homepage text",
    );
  } finally {
    await db.close();
  }
});

test("local draft migration changes only the requested legal fields", () => {
  const catalog = {
    content: [
      {
        id: "owned-privacy",
        key: "privacy",
        title: { tr: "Old", en: "Keep", ru: "Keep" },
        body: { tr: "Old", en: "Keep", ru: "Keep" },
      },
    ],
    products: [{ id: "owner-product", price: 9876 }],
  } as unknown as import("../src/lib/types").Catalog;
  const result = applyLegalPages(catalog);
  assert.equal(result.content.length, 5);
  assert.equal(
    result.content.find((row) => row.key === "privacy")?.id,
    "owned-privacy",
  );
  assert.equal(
    result.content.find((row) => row.key === "privacy")?.body.en,
    "Keep",
  );
  assert.equal(result.products[0].price, 9876);
  assert.equal(catalog.content.length, 1);
});
