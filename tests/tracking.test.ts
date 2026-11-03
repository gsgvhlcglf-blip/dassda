import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validTrackingTemplate,
  trackingLink,
  trackingConfiguration,
} from "../src/lib/tracking";
import { safeNext } from "../src/lib/customer-navigation";
test("tracking requires configured HTTPS URLs and validates numbers without inventing shipment state", () => {
  assert.equal(trackingConfiguration({ content: [] }, "tr").ready, false);
  assert.equal(
    trackingLink("https://carrier.example/track?id={tracking}", "ABC-123"),
    "https://carrier.example/track?id=ABC-123",
  );
  assert.equal(
    trackingLink("https://carrier.example/track", "ABC-123"),
    "https://carrier.example/track",
  );
  for (const url of [
    "javascript:alert(1)",
    "http://carrier.example",
    "https://password@carrier.example/",
    "https://{tracking}.example/",
  ])
    assert.equal(validTrackingTemplate(url), false);
  for (const number of ["", "../oops", "abc&redirect=evil", "a"])
    assert.equal(
      trackingLink("https://carrier.example/{tracking}", number),
      null,
    );
});
test("membership return addresses remain on the storefront", () => {
  for (const url of [
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "/api/customer",
    "/admin",
    "/\nevil.example",
  ])
    assert.equal(safeNext(url), "/hesabim");
  assert.equal(safeNext("/odeme?lang=ru"), "/odeme?lang=ru");
});
