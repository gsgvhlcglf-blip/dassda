import { test } from "node:test";
import assert from "node:assert/strict";
import { validateDesign } from "../quick-panel/design.mjs";
test("request image choices survive visual backup validation", () => {
  const images = Object.fromEntries(
    [
      "requests.material.forged",
      "requests.material.twill",
      "requests.manufacturing_method.lamination",
      "requests.manufacturing_method.infusion",
    ].map((key) => [key, "data:image/webp;base64,AAAA"]),
  );
  assert.deepEqual(validateDesign({ texts: {}, images }).images, images);
});
test("legacy visual drafts and backups retain copy/images when logo scaling is added", () => {
  const old = {
    texts: { tr: { "ui:chooseBrand": "Sahibin başlığı" } },
    images: { "brand:ducati": "data:image/webp;base64,AAAA" },
  };
  const normalized = validateDesign(old);
  assert.equal(
    normalized.texts.tr["ui:chooseBrand"],
    old.texts.tr["ui:chooseBrand"],
  );
  assert.deepEqual(normalized.images, old.images);
  assert.deepEqual(normalized.logoScales, {});
  const scaled = validateDesign({
    ...normalized,
    logoScales: { "brand:ducati": 85, "brand:bmw": 200 },
  });
  assert.deepEqual(validateDesign(JSON.parse(JSON.stringify(scaled))), scaled);
  assert.deepEqual(old, {
    texts: { tr: { "ui:chooseBrand": "Sahibin başlığı" } },
    images: { "brand:ducati": "data:image/webp;base64,AAAA" },
  });
});
test("logo scaling rejects invalid bounds, nonnumeric values and unrelated image slots", () => {
  for (const value of [49, 201, NaN, Infinity, 75.5, "100", null])
    assert.throws(() =>
      validateDesign({
        texts: {},
        images: {},
        logoScales: { "brand:ducati": value },
      }),
    );
  for (const logoScales of [[], 42, { "home.hero": 100 }])
    assert.throws(() => validateDesign({ texts: {}, images: {}, logoScales }));
});

test("alignment offsets round trip in backups without changing legacy drafts", () => {
  const draft = validateDesign({
    texts: {},
    images: {},
    logoOffsets: { "brand:ducati": { x: 12.5, y: -8 } },
  });
  assert.deepEqual(validateDesign(JSON.parse(JSON.stringify(draft))), draft);
  assert.deepEqual(validateDesign({ texts: {}, images: {} }).logoOffsets, {});
  for (const offset of [
    { x: 113, y: 0 },
    { x: 0, y: NaN },
    { x: "1", y: 0 },
    null,
  ])
    assert.throws(() =>
      validateDesign({
        texts: {},
        images: {},
        logoOffsets: { "brand:ducati": offset },
      }),
    );
});
