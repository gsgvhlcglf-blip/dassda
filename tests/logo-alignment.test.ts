import { test } from "node:test";
import assert from "node:assert/strict";
import {
  calculateLogoAlignment,
  type LogoMeasurement,
} from "../quick-panel/site/logo-alignment";
function logo(
  key: string,
  height: number,
  percent = 100,
  baseOffset = { x: 0, y: 0 },
  oldOffset = { x: 0, y: 0 },
  responsive = 1,
): LogoMeasurement {
  const effectiveScale = (responsive * percent) / 100,
    w = 80 * effectiveScale,
    h = height * effectiveScale;
  return {
    key,
    bounds: {
      x: 100 - w / 2 + (baseOffset.x + oldOffset.x) * effectiveScale,
      y: 100 - h / 2 + (baseOffset.y + oldOffset.y) * effectiveScale,
      width: w,
      height: h,
    },
    slot: { x: 30, y: 30, width: 140, height: 140 },
    effectiveScale,
    percent,
    offset: oldOffset,
  };
}
test("aligns different logo shapes to the selected height and centers their visible bounds", () => {
  const inputs = [
    logo("brand:a", 108, 130),
    logo("brand:b", 114, 80, { x: 12, y: -9 }),
    logo("brand:c", 104, 100, { x: -10, y: 8 }),
  ];
  const result = calculateLogoAlignment(inputs, "brand:a");
  assert.equal(result.scales["brand:a"], 130);
  assert.equal(result.limited, false);
  for (const item of inputs) {
    const originalHeight = item.bounds.height / (item.percent / 100),
      newHeight = (originalHeight * result.scales[item.key]) / 100;
    assert.ok(Math.abs(newHeight - inputs[0].bounds.height) < 1);
  }
  assert.deepEqual(result.offsets["brand:b"], { x: -12, y: 9 });
  assert.deepEqual(result.offsets["brand:c"], { x: 10, y: -8 });
});
test("alignment offsets remain stable across mobile scale and repeated alignment", () => {
  const first = calculateLogoAlignment(
    [logo("brand:a", 108), logo("brand:b", 110, 200, { x: 18, y: -14 })],
    "brand:a",
  );
  const again = calculateLogoAlignment(
    [
      logo("brand:a", 108, 100, { x: 0, y: 0 }, first.offsets["brand:a"], 0.62),
      logo(
        "brand:b",
        110,
        first.scales["brand:b"],
        { x: 18, y: -14 },
        first.offsets["brand:b"],
        0.62,
      ),
    ],
    "brand:a",
  );
  assert.deepEqual(again.offsets, first.offsets);
  assert.deepEqual(again.scales, first.scales);
});
test("finds a common height within allowed bounds and reports incompatible assets", () => {
  const bounded = calculateLogoAlignment(
    [logo("brand:a", 100, 200), logo("brand:b", 40)],
    "brand:a",
  );
  assert.equal(bounded.limited, true);
  assert.equal(bounded.scales["brand:a"], 80);
  assert.equal(bounded.scales["brand:b"], 200);
  const impossible = calculateLogoAlignment(
    [logo("brand:a", 100), logo("brand:b", 10)],
    "brand:a",
  );
  assert.equal(impossible.limited, true);
  assert.equal(impossible.sizesMatched, false);
  assert.ok(
    Object.values(impossible.scales).every(
      (value) => value >= 50 && value <= 200,
    ),
  );
  assert.throws(() =>
    calculateLogoAlignment(
      [logo("brand:a", 0), logo("brand:b", 100)],
      "brand:a",
    ),
  );
});
