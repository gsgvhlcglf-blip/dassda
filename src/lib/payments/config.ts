import "server-only";
import type { PaymentMode, PaymentSettings } from "./types";
import type { Credentials } from "./providers";
export function paymentCredentials(
  provider: "paytr" | "iyzico",
  mode: PaymentMode,
): Credentials {
  if (provider === "paytr")
    return {
      paytr: {
        id: process.env.PAYTR_MERCHANT_ID || "",
        key: process.env.PAYTR_MERCHANT_KEY || "",
        salt: process.env.PAYTR_MERCHANT_SALT || "",
      },
    };
  return {
    iyzico: {
      key:
        process.env[
          mode === "test" ? "IYZICO_TEST_API_KEY" : "IYZICO_LIVE_API_KEY"
        ] || "",
      secret:
        process.env[
          mode === "test" ? "IYZICO_TEST_SECRET_KEY" : "IYZICO_LIVE_SECRET_KEY"
        ] || "",
    },
  };
}
export function paymentOrigin() {
  try {
    const url = new URL(process.env.NEXT_PUBLIC_SITE_URL || "");
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash ||
      ["localhost", "127.0.0.1", "::1"].includes(url.hostname)
    )
      return null;
    return url.origin;
  } catch {
    return null;
  }
}
export function paymentReadiness(settings: PaymentSettings, isLive: boolean) {
  const missing: string[] = [];
  if (!paymentOrigin()) missing.push("HTTPS site adresi");
  if (isLive && !process.env.SUPABASE_SERVICE_ROLE_KEY)
    missing.push("Sunucu veritabanı yetkisi");
  if (settings.mode === "live" && !isLive) missing.push("Canlı veritabanı");
  if (settings.provider === "none") missing.push("Ödeme sağlayıcısı");
  else {
    const credentials = paymentCredentials(settings.provider, settings.mode);
    if (
      settings.provider === "paytr" &&
      Object.values(credentials.paytr!).some((v) => !v)
    )
      missing.push("PayTR mağaza bilgileri");
    if (
      settings.provider === "iyzico" &&
      Object.values(credentials.iyzico!).some((v) => !v)
    )
      missing.push(
        "iyzico " +
          (settings.mode === "test" ? "test" : "canlı") +
          " anahtarları",
      );
  }
  return { ready: missing.length === 0, missing };
}
