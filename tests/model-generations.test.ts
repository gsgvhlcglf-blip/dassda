import { test } from "node:test";
import assert from "node:assert/strict";
import { seed } from "../src/lib/seed";
import {
  applyModelGenerations,
  generationInputs,
  currentModelYear,
  generationRangeLabel,
  resolveOngoingYears,
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

test("ongoing selection persists separately, resolves the current year and rejects future starts", () => {
  const year = currentModelYear();
  const catalog = structuredClone(seed);
  catalog.models.push({
    ...catalog.models[0],
    id: "ongoing-r25",
    slug: "ongoing-r25",
    name: "R25",
  });
  const value = [
    {
      id: "ongoing-generation",
      name: "Yeni kasa",
      start_year: year - 1,
      end_year: "",
      ongoing: true,
    },
  ];
  const updated = validateCatalog(
    applyModelGenerations(catalog, "ongoing-r25", value),
  );
  const g = updated.generations.find((row) => row.id === "ongoing-generation")!;
  assert.equal(g.ongoing, true);
  assert.equal(g.end_year, year);
  assert.equal(generationRangeLabel(g), `${year - 1}–Günümüz`);
  assert.equal(generationInputs(updated, "ongoing-r25")[0].ongoing, true);
  assert.deepEqual(
    updated.model_years
      .filter((row) => row.model_id === "ongoing-r25")
      .map((row) => row.year),
    [year - 1, year],
  );
  assert.throws(
    () =>
      applyModelGenerations(catalog, "ongoing-r25", [
        { ...value[0], start_year: year + 1 },
      ]),
    /yıllarını/,
  );
  assert.throws(
    () =>
      applyModelGenerations(catalog, "ongoing-r25", [
        { ...value[0], ongoing: "true" },
      ]),
    /Günümüz/,
  );
  const fixed = applyModelGenerations(updated, "ongoing-r25", [
    { ...value[0], ongoing: false, end_year: year - 1 },
  ]);
  assert.equal(
    fixed.generations.find((row) => row.id === g.id)!.ongoing,
    false,
  );
  assert.equal(
    fixed.model_years.filter((row) => row.model_id === "ongoing-r25").length,
    1,
  );
});

test("year rollover keeps fixed ranges, row identities and explicit product compatibility", () => {
  const year = currentModelYear();
  const catalog = structuredClone(seed);
  catalog.models.push({
    ...catalog.models[0],
    id: "rollover-r25",
    slug: "rollover-r25",
    name: "R25",
  });
  const current = applyModelGenerations(catalog, "rollover-r25", [
    {
      id: "rollover-generation",
      name: "Güncel",
      start_year: year - 1,
      end_year: year,
      ongoing: true,
    },
  ]);
  current.compatibility.push({
    id: "explicit-fit",
    product_id: "p1",
    model_id: "rollover-r25",
    generation_id: "rollover-generation",
    year_from: year - 1,
    year_to: year,
  });
  const future = resolveOngoingYears(current, year + 1);
  assert.equal(
    future.generations.find((row) => row.id === "rollover-generation")!
      .end_year,
    year + 1,
  );
  for (const row of current.model_years)
    assert.ok(future.model_years.some((next) => next.id === row.id));
  assert.deepEqual(future.compatibility, current.compatibility);
  assert.equal(compatibleProducts(future, "rollover-r25", year).length, 1);
  assert.equal(compatibleProducts(future, "rollover-r25", year + 1).length, 0);
  assert.deepEqual(resolveOngoingYears(current, year + 1), future);
  assert.equal(
    current.model_years.some(
      (row) => row.model_id === "rollover-r25" && row.year === year + 1,
    ),
    false,
  );
  assert.deepEqual(
    future.generations.filter((row) => !row.ongoing),
    current.generations.filter((row) => !row.ongoing),
  );
});

test("ongoing generation must be last and retains overlap protection", () => {
  const year = currentModelYear();
  const catalog = structuredClone(seed);
  catalog.models.push({
    ...catalog.models[0],
    id: "last-r25",
    slug: "last-r25",
    name: "R25",
  });
  assert.throws(
    () =>
      applyModelGenerations(catalog, "last-r25", [
        {
          id: "first-ongoing",
          name: "Devam",
          start_year: year - 2,
          end_year: year,
          ongoing: true,
        },
        {
          id: "future-range",
          name: "Sonraki",
          start_year: year + 1,
          end_year: year + 2,
        },
      ]),
    /son nesilde/,
  );
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
