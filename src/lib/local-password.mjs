import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
/** @param {string} password */
export function hashLocalPassword(password) {
  if (
    typeof password !== "string" ||
    password.length < 12 ||
    password.length > 128
  ) {
    throw new Error("Sifre 12 ile 128 karakter arasinda olmalidir.");
  }
  const salt = randomBytes(16).toString("hex");
  return `scrypt:${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}
/** @param {string} password @param {string} stored */
export function verifyLocalPassword(password, stored) {
  if (
    typeof password !== "string" ||
    password.length > 128 ||
    !/^scrypt:[a-f0-9]{32}:[a-f0-9]{128}$/.test(stored)
  )
    return false;
  const [, salt, expected] = stored.split(":");
  const actual = scryptSync(password, salt, 64);
  return timingSafeEqual(actual, Buffer.from(expected, "hex"));
}
