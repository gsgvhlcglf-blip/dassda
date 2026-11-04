import { test } from "node:test";
import assert from "node:assert/strict";
import { validateDesign } from "../quick-panel/design.mjs";
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
