import { test } from "node:test";
import assert from "node:assert/strict";
import { seed } from "../src/lib/seed";
import {
  applyProductCompatibility,
  compatibilityInputs,
} from "../src/lib/product-compatibility";
import { applyModelGenerations } from "../src/lib/model-generations";
import { compatibleProducts } from "../src/lib/commerce";
import { validateCatalog } from "../src/lib/site-version";

const input = (
  id: string,
  brand_id: string,
  model_id: string,
  year_from: number,
  year_to: number,
  generation_id: string | null = null,
) => ({ id, brand_id, model_id, year_from, year_to, generation_id });
test("a product supports multiple brands/models and exact year ranges without changing other products or inventory", () => {
  const original = structuredClone(seed);
  const next = validateCatalog(
    applyProductCompatibility(original, "p1", [
      input("p1-new-yamaha", "yamaha", "yamaha-mt-25", 2024, 2025),
      input("p1-new-bmw", "bmw", "bmw-s1000rr", 2023, 2023),
      input("p1-new-ducati", "ducati", "ducati-monster", 2026, 2026),
    ]),
  );
  for (const [model, year, expected] of [
    ["yamaha-mt-25", 2024, true],
    ["yamaha-mt-25", 2022, false],
    ["yamaha-mt-25", 2026, false],
    ["bmw-s1000rr", 2023, true],
    ["bmw-s1000rr", 2024, false],
    ["ducati-monster", 2026, true],
  ] as const)
    assert.equal(
      compatibleProducts(next, model, year).some((p) => p.id === "p1"),
      expected,
    );
  assert.deepEqual(
    next.compatibility.filter((f) => f.product_id !== "p1"),
    original.compatibility.filter((f) => f.product_id !== "p1"),
  );
  for (const key of [
    "products",
    "variants",
    "product_images",
    "models",
    "model_years",
    "generations",
    "content",
  ] as const)
    assert.deepEqual(next[key], original[key]);
  assert.deepEqual(original, seed);
});
test("cross-generation ranges and separate periods work; generation, year, brand and identity mistakes are rejected", () => {
  const c = applyModelGenerations(seed, "yamaha-mt-25", [
    {
      id: "yamaha-mt-25-demo",
      name: "Birinci",
      start_year: 2022,
      end_year: 2023,
    },
    { id: "yamaha-next", name: "İkinci", start_year: 2024, end_year: 2026 },
  ]);
  const cross = applyProductCompatibility(c, "p1", [
    input("cross", "yamaha", "yamaha-mt-25", 2023, 2025),
  ]);
  assert.equal(
    cross.compatibility.find((f) => f.id === "cross")?.generation_id,
    null,
  );
  for (const y of [2023, 2024, 2025])
    assert(
      compatibleProducts(cross, "yamaha-mt-25", y).some((p) => p.id === "p1"),
    );
  const row = input("fit", "yamaha", "yamaha-mt-25", 2024, 2025, "yamaha-next");
  for (const bad of [
    { ...row, brand_id: "ducati" },
    { ...row, year_from: 2023 },
    { ...row, generation_id: "bmw-s1000rr-demo" },
    { ...row, year_to: 2027 },
    { ...row, year_from: 2026 },
    { ...row, year_from: "2024" },
    { ...row, model_id: "unknown" },
    { ...row, id: seed.compatibility.find((f) => f.product_id === "p2")!.id },
    { ...row, product_id: "p2" },
  ])
    assert.throws(() => applyProductCompatibility(c, "p1", [bad]));
  assert.throws(
    () => applyProductCompatibility(c, "p1", [row, { ...row, id: "overlap" }]),
    /çakışıyor/,
  );
  assert.equal(
    applyProductCompatibility(c, "p1", [
      input("a", "yamaha", "yamaha-mt-25", 2022, 2023),
      input("b", "yamaha", "yamaha-mt-25", 2025, 2026),
    ]).compatibility.filter((f) => f.product_id === "p1").length,
    2,
  );
  assert.deepEqual(seed.products, c.products);
});
test("unchanged legacy fitments and IDs survive unrelated product edits; removing all fitments preserves the product", () => {
  const c = structuredClone(seed);
  c.model_years = c.model_years.filter((y) => y.year !== 2022);
  const next = applyProductCompatibility(c, "p1", compatibilityInputs(c, "p1"));
  assert.deepEqual(next, c);
  const cleared = applyProductCompatibility(c, "p1", []);
  assert(!cleared.compatibility.some((f) => f.product_id === "p1"));
  assert.deepEqual(cleared.products, c.products);
  assert.deepEqual(cleared.product_images, c.product_images);
});
