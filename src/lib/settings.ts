import type { Lang } from "./types";
// Keep order currency in sync with the database's create_order_request RPC when adding currencies.
export const storeSettings = {
  currency: "TRY",
  defaultLanguage: "tr",
} as const;
export const indexingEnabled =
  process.env.ENABLE_INDEXING === "true" && !!process.env.NEXT_PUBLIC_SITE_URL;

// Keep stored translations intact while the public storefront uses Turkish only.
export const supportedLanguages: readonly Lang[] = ["tr"];
export function resolveStoreLanguage(value: unknown): Lang {
  return typeof value === "string" && supportedLanguages.includes(value as Lang)
    ? (value as Lang)
    : storeSettings.defaultLanguage;
}
