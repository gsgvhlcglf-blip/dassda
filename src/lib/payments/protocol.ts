import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
export function sameSignature(actual: string, expected: string) {
  const a = Buffer.from(actual),
    b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
export function paytrToken(
  fields: {
    merchantId: string;
    ip: string;
    merchantRef: string;
    email: string;
    amountMinor: number;
    basket: string;
    test: boolean;
  },
  key: string,
  salt: string,
) {
  return createHmac("sha256", key)
    .update(
      fields.merchantId +
        fields.ip +
        fields.merchantRef +
        fields.email +
        fields.amountMinor +
        fields.basket +
        "1" +
        "0" +
        "TL" +
        (fields.test ? "1" : "0") +
        salt,
    )
    .digest("base64");
}
export function paytrCallbackSignature(
  reference: string,
  status: string,
  amount: string,
  key: string,
  salt: string,
) {
  return createHmac("sha256", key)
    .update(reference + salt + status + amount)
    .digest("base64");
}
export function iyzicoAuthorization(
  path: string,
  body: string,
  key: string,
  secret: string,
  nonce = randomBytes(20).toString("hex"),
) {
  const signature = createHmac("sha256", secret)
    .update(nonce + path + body)
    .digest("hex");
  return {
    authorization:
      "IYZWSv2 " +
      Buffer.from(
        "apiKey:" + key + "&randomKey:" + nonce + "&signature:" + signature,
      ).toString("base64"),
    nonce,
  };
}
export function iyzicoSignature(values: unknown[], secret: string) {
  return createHmac("sha256", secret).update(values.join(":")).digest("hex");
}
export function minorUnits(value: unknown) {
  const s = String(value);
  if (!/^\d{1,12}(\.\d{1,2})?$/.test(s)) throw Error("INVALID_AMOUNT");
  const [whole, fraction = ""] = s.split(".");
  const minor = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(minor)) throw Error("INVALID_AMOUNT");
  return minor;
}
export function amountString(minor: number) {
  if (!Number.isSafeInteger(minor) || minor <= 0) throw Error("INVALID_AMOUNT");
  return Math.floor(minor / 100) + "." + String(minor % 100).padStart(2, "0");
}
export function safeCheckoutURL(
  provider: "paytr" | "iyzico",
  mode: "test" | "live",
  value: string,
) {
  try {
    const url = new URL(value);
    const allowed =
      provider === "paytr"
        ? url.hostname === "www.paytr.com" &&
          /^\/odeme\/guvenli\/[a-zA-Z0-9_-]+$/.test(url.pathname)
        : url.hostname ===
          (mode === "test" ? "sandbox-cpp.iyzipay.com" : "cpp.iyzipay.com");
    if (
      !allowed ||
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port
    )
      throw Error();
    return url.href;
  } catch {
    throw Error("INVALID_CHECKOUT_URL");
  }
}
