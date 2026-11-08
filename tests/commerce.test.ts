import { test } from "node:test";
import assert from "node:assert/strict";
import { seed } from "../src/lib/seed";
import { compatibleProducts, quote } from "../src/lib/commerce";
import { orderSchema, schemas } from "../src/lib/validation";
test("exact model + database year + generation + year range filtering", () => {
  const c = structuredClone(seed);
  c.compatibility = [
    {
      id: "test",
      product_id: "p1",
      model_id: "yamaha-mt-25",
      generation_id: "yamaha-mt-25-demo",
      year_from: 2024,
      year_to: 2024,
    },
  ];
  assert.deepEqual(
    compatibleProducts(c, "yamaha-mt-25", 2024).map((p) => p.id),
    ["p1"],
  );
  assert.equal(compatibleProducts(c, "yamaha-mt-25", 2023).length, 0);
  assert.equal(compatibleProducts(c, "bmw-s1000rr", 2024).length, 0);
  assert.equal(compatibleProducts(c, "yamaha-mt-25", 2030).length, 0);
  c.compatibility[0].generation_id = "wrong-generation";
  assert.equal(compatibleProducts(c, "yamaha-mt-25", 2024).length, 0);
});
test("a product can match multiple brands and models", () => {
  assert.ok(
    compatibleProducts(seed, "yamaha-mt-25", 2024).some((p) => p.id === "p1"),
  );
  assert.ok(
    compatibleProducts(seed, "ducati-diavel-1200", 2024).some(
      (p) => p.id === "p1",
    ),
  );
});
test("quote uses stored product prices and combines duplicate lines", () => {
  const q = quote(seed, [
    { productId: "p1", variantId: "p1-gloss", quantity: 2 },
    { productId: "p1", variantId: "p1-gloss", quantity: 1 },
  ]);
  assert.equal(q.total, 6850 * 3);
  assert.equal(q.items.length, 1);
  assert.equal(q.demo, true);
});
test("reject invalid variants, quantities, disabled finishes and unpublished products", () => {
  assert.throws(
    () =>
      quote(seed, [{ productId: "p2", variantId: "p1-gloss", quantity: 1 }]),
    /INVALID_VARIANT/,
  );
  assert.equal(
    quote(seed, [{ productId: "p1", variantId: "p1-gloss", quantity: 7 }])
      .total,
    6850 * 7,
  );
  assert.throws(
    () =>
      quote(seed, [{ productId: "p1", variantId: "p1-gloss", quantity: 0 }]),
    /INVALID_QUANTITY/,
  );
  const c = structuredClone(seed);
  c.products[0].published = false;
  assert.throws(
    () => quote(c, [{ productId: "p1", variantId: "p1-gloss", quantity: 1 }]),
    /INVALID_VARIANT/,
  );
  c.products[0].published = true;
  c.products[0].stock = 1;
  assert.throws(
    () =>
      quote(c, [
        { productId: "p1", variantId: "p1-gloss", quantity: 1 },
        { productId: "p1", variantId: "p1-matte", quantity: 1 },
      ]),
    /INVALID_VARIANT/,
  );
});
test("validation requires consent and rejects illegal year ranges", () => {
  assert.equal(orderSchema.safeParse({ lines: [] }).success, false);
  assert.equal(
    schemas.compatibility.safeParse({
      id: "x",
      product_id: "p1",
      model_id: "yamaha-mt-25",
      generation_id: null,
      year_from: 2025,
      year_to: 2024,
    }).success,
    false,
  );
});
