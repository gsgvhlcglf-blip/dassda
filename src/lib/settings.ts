// Keep order currency in sync with the database's create_order_request RPC when adding currencies.
export const storeSettings = {
  currency: "TRY",
  defaultLanguage: "tr",
} as const;
export const indexingEnabled =
  process.env.ENABLE_INDEXING === "true" && !!process.env.NEXT_PUBLIC_SITE_URL;
