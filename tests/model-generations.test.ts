import { test } from "node:test";
import assert from "node:assert/strict";
import { seed } from "../src/lib/seed";
import {
  applyModelGenerations,
  generationInputs,
} from "../src/lib/model-generations";
import { compatibleProducts } from "../src/lib/commerce";
import { validateCatalog } from "../src/lib/site-version";

const modelId = "yamaha-mt-25";
function groups() {
  return [
    {
      id: `${modelId}-demo`,
      name: "1. nesil · ilk kasa",
      start_year: 2022,
      end_year: 2023,
    },
    {
      id: "test-second-generation",
      name: "2. nesil · yeni kasa",
      start_year: 2024,
      end_year: 2025,
    },
    {
      id: "test-third-generation",
      name: "3. nesil · son kasa",
      start_year: 2026,
      end_year: 2026,
    },
  ];
}
test("splitting a model into three generations preserves exact-year product compatibility and year IDs", () => {
  const original = structuredClone(seed);
  const next = validateCatalog(
    applyModelGenerations(original, modelId, groups()),
  );
  assert.equal(
    next.generations.filter((g) => g.model_id === modelId).length,
    3,
  );
  for (let year = 2022; year <= 2026; year++) {
    assert.deepEqual(
      compatibleProducts(next, modelId, year)
        .map((p) => p.id)
        .sort(),
      compatibleProducts(original, modelId, year)
        .map((p) => p.id)
        .sort(),
    );
    assert.equal(
      next.model_years.find((y) => y.model_id === modelId && y.year === year)
        ?.id,
      original.model_years.find(
        (y) => y.model_id === modelId && y.year === year,
      )?.id,
    );
  }
  for (const key of [
    "models",
    "products",
    "product_images",
    "variants",
    "content",
  ] as const)
    assert.deepEqual(next[key], original[key]);
  assert.deepEqual(original, seed);
});
test("ranges never extend an existing part's fitment and reject overlapping years, gaps, foreign IDs and invalid inputs", () => {
  const c = structuredClone(seed);
  const f = c.compatibility.find((f) => f.model_id === modelId)!;
  f.year_from = 2023;
  f.year_to = 2024;
  const next = applyModelGenerations(c, modelId, groups());
  assert.deepEqual(
    next.compatibility
      .filter((r) => r.model_id === modelId && r.product_id === f.product_id)
      .map((r) => [r.year_from, r.year_to]),
    [
      [2023, 2023],
      [2024, 2024],
    ],
  );
  const overlap = groups();
  overlap[1].start_year = 2023;
  assert.throws(() => applyModelGenerations(c, modelId, overlap), /çakışıyor/);
  assert.throws(
    () => applyModelGenerations(c, modelId, [groups()[0], groups()[2]]),
    /uyumluluğu/,
  );
  assert.throws(
    () =>
      applyModelGenerations(c, modelId, [
        { ...groups()[0], id: seed.generations[0].id },
      ]),
    /başka bir modele/,
  );
  for (const input of [
    null,
    {},
    [null],
    [{ ...groups()[0], start_year: "2022" }],
    [{ ...groups()[0], name: "" }],
    [{ ...groups()[0], end_year: 2021 }],
  ])
    assert.throws(() => applyModelGenerations(c, modelId, input));
  assert.equal(c.generations.filter((g) => g.model_id === modelId).length, 1);
});
test("description-only edits preserve sparse years and every existing relation; new models create years without inventing fitments", () => {
  const c = structuredClone(seed);
  c.model_years = c.model_years.filter(
    (y) => y.model_id !== modelId || y.year !== 2023,
  );
  const input = generationInputs(c, modelId);
  input[0].name = "Açıklama değişti";
  const next = applyModelGenerations(c, modelId, input);
  assert.deepEqual(next.model_years, c.model_years);
  assert.deepEqual(next.compatibility, c.compatibility);
  const fresh = structuredClone(seed);
  fresh.models.push({
    ...fresh.models[0],
    id: "new-r25",
    slug: "new-r25",
    name: "R25 örneği",
  });
  const result = validateCatalog(
    applyModelGenerations(
      fresh,
      "new-r25",
      groups().map((g, i) => ({ ...g, id: "new-g-" + i })),
    ),
  );
  assert.equal(
    result.model_years.filter((y) => y.model_id === "new-r25").length,
    5,
  );
  assert(!result.compatibility.some((f) => f.model_id === "new-r25"));
});
