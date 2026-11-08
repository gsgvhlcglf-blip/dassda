import test from "node:test";
import assert from "node:assert/strict";
import { consentLifetime, parseCookieChoice } from "../src/lib/cookie-consent";
test("only current explicit choices activate analytics; expired, legacy and malformed choices are ignored", () => {
  const now = Date.now(),
    choice = {
      version: 1,
      analytics: true,
      savedAt: now - 1000,
      expiresAt: now - 1000 + consentLifetime,
    };
  assert.deepEqual(parseCookieChoice(choice, now), choice);
  assert.equal(
    parseCookieChoice({ ...choice, analytics: false }, now)?.analytics,
    false,
  );
  for (const invalid of [
    null,
    "yes",
    {},
    { ...choice, version: 0 },
    { ...choice, analytics: "yes" },
    { ...choice, savedAt: now + 1 },
    { ...choice, expiresAt: now },
    { ...choice, expiresAt: choice.expiresAt + 1 },
  ])
    assert.equal(parseCookieChoice(invalid, now), null);
});
