import { test } from "node:test";
import assert from "node:assert/strict";
import { applyCatalogUpdates } from "../quick-panel/catalog-updates.mjs";
import { seed } from "../src/lib/seed";
test("requested copy changes are applied once and preserve unrelated owner edits", () => {
  const catalog = structuredClone(seed);
  catalog.products[0].price = 999;
  const updates = [
    {
      id: "hero-heading-1",
      table: "content",
      recordId: "home",
      changes: { title: { tr: "Yeni başlık" } },
    },
  ];
  const result = applyCatalogUpdates(catalog, updates);
  assert.equal(
    result.catalog.content.find((r) => r.id === "home")?.title.tr,
    "Yeni başlık",
  );
  assert.equal(result.catalog.products[0].price, 999);
  assert.equal(
    result.catalog.content.find((r) => r.id === "home")?.title.en,
    seed.content.find((r) => r.id === "home")?.title.en,
  );
  result.catalog.content.find((r) => r.id === "home")!.title.tr =
    "Owner edit after update";
  const again = applyCatalogUpdates(result.catalog, updates, result.appliedIds);
  assert.equal(
    again.catalog.content.find((r) => r.id === "home")?.title.tr,
    "Owner edit after update",
  );
  assert.equal(again.changed, false);
  assert.equal(
    catalog.content.find((r) => r.id === "home")?.title.tr,
    seed.content.find((r) => r.id === "home")?.title.tr,
  );
});
test("catalog update cannot change IDs, prototypes, customer orders or deleted owner records", () => {
  for (const changes of [
    { id: "wrong" },
    JSON.parse('{"__proto__":{"polluted":true}}'),
  ])
    assert.throws(() =>
      applyCatalogUpdates(seed, [
        { id: "bad", table: "content", recordId: "home", changes },
      ]),
    );
  assert.throws(() =>
    applyCatalogUpdates(seed, [
      { id: "private", table: "orders", recordId: "x", changes: {} },
    ]),
  );
  const result = applyCatalogUpdates(seed, [
    {
      id: "deleted",
      table: "products",
      recordId: "not-present",
      changes: { price: 1 },
    },
  ]);
  assert.equal(result.changed, false);
  assert.equal(result.catalog.products.length, seed.products.length);
});
test("explicit legal-page creation preserves drafts and is not replayed after owner edits/deletion", () => {
  const catalog = structuredClone(seed);
  catalog.content = catalog.content.filter(
    (row) => row.id !== "pre-information",
  );
  catalog.products[0].price = 9876;
  const page = seed.content.find((row) => row.id === "pre-information")!;
  const { id, ...changes } = page;
  const updates = [
    {
      id: "legal-create-1",
      table: "content",
      recordId: id,
      createIfMissing: true,
      changes,
    },
  ];
  const result = applyCatalogUpdates(catalog, updates);
  assert.equal(result.catalog.content.filter((row) => row.id === id).length, 1);
  assert.equal(result.catalog.products[0].price, 9876);
  result.catalog.content.find((row) => row.id === id)!.body.tr =
    "Owner legal edit";
  assert.equal(
    applyCatalogUpdates(
      result.catalog,
      updates,
      result.appliedIds,
    ).catalog.content.find((row) => row.id === id)?.body.tr,
    "Owner legal edit",
  );
  result.catalog.content = result.catalog.content.filter(
    (row) => row.id !== id,
  );
  assert(
    !applyCatalogUpdates(
      result.catalog,
      updates,
      result.appliedIds,
    ).catalog.content.some((row) => row.id === id),
  );
  assert.throws(() =>
    applyCatalogUpdates(catalog, [{ ...updates[0], table: "products" }]),
  );
  assert.throws(() =>
    applyCatalogUpdates(catalog, [
      {
        ...updates[0],
        changes: { ...changes, body: { tr: "only one locale" } },
      },
    ]),
  );
});
