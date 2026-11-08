import test from "node:test";
import assert from "node:assert/strict";
import { seed } from "../src/lib/seed";
import {
  readBestsellers,
  withBestsellers,
  bestsellersSchema,
  bestsellerRecord,
} from "../src/lib/bestsellers";
import {
  applyEditorialContent,
  aboutEditorial,
  cookieNoticeReplacements,
} from "../src/lib/editorial-content";
import { schemas } from "../src/lib/validation";
test("bestsellers accept ten distinct products, 200% framing and valid cadence; malformed settings never render", () => {
  const config = {
    productIds: Array.from({ length: 10 }, (_, i) => "product-" + i),
    intervalSeconds: 5,
    frames: {
      "product-0": { scale: 200, x: 50, y: 50, role: "overview" as const },
    },
  };
  assert(bestsellersSchema.safeParse(config).success);
  for (const bad of [
    { ...config, productIds: [...config.productIds, "extra"] },
    { ...config, productIds: ["p1", "p1"] },
    { ...config, intervalSeconds: 1 },
    {
      ...config,
      frames: { p1: { scale: 201, x: 50, y: 50, role: "overview" } },
    },
  ])
    assert(!bestsellersSchema.safeParse(bad).success);
  const updated = withBestsellers(seed, config);
  assert.deepEqual(readBestsellers(updated), config);
  assert.equal(updated.products[0].price, seed.products[0].price);
  const malformed = bestsellerRecord(config);
  malformed.body.tr = JSON.stringify({ ...config, productIds: ["p1", "p1"] });
  assert(!schemas.content.safeParse(malformed).success);
  assert.equal(readBestsellers({ content: [malformed] }).productIds.length, 0);
});
test("editorial migration preserves owner inventory, curation, policy business fields and earlier articles", () => {
  const catalog = structuredClone(seed);
  catalog.products[0].price = 9876;
  const privacy = catalog.content.find((r) => r.key === "privacy")!;
  privacy.body.tr = "My Company Ltd · " + cookieNoticeReplacements[0].from;
  const config = { productIds: ["p4", "p2"], intervalSeconds: 8, frames: {} };
  const curated = withBestsellers(catalog, config);
  const blog = curated.content.find((r) => r.key.startsWith("blog-"))!;
  blog.body.tr = "Owner article";
  const next = applyEditorialContent(curated);
  assert.equal(next.products[0].price, 9876);
  assert.deepEqual(readBestsellers(next), config);
  assert.equal(
    next.content.find((r) => r.id === blog.id)?.body.tr,
    "Owner article",
  );
  assert(
    next.content
      .find((r) => r.key === "privacy")
      ?.body.tr.startsWith("My Company Ltd"),
  );
  assert.equal(
    next.content.find((r) => r.key === "about")?.body.tr,
    aboutEditorial.tr,
  );
  assert(!/ducati|bmw|yamaha/i.test(aboutEditorial.tr));
  assert.equal(next.content.filter((r) => r.key.startsWith("blog-")).length, 3);
});
