/** Server configuration only. Never serialize environment values to the browser. */
export type DataProvider = "sqlite-demo" | "supabase" | "mysql";
export type PersistenceEnvironment = Record<string, string | undefined>;

export function dataProvider(env: PersistenceEnvironment): DataProvider {
  const selected = env.DATA_PROVIDER || "auto";
  if (!["auto", "sqlite-demo", "supabase", "mysql"].includes(selected))
    throw Error("DATA_PROVIDER_INVALID");
  const hasUrl = !!env.NEXT_PUBLIC_SUPABASE_URL;
  const hasKey = !!env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (selected === "auto" && hasUrl !== hasKey)
    throw Error("SUPABASE_CONFIGURATION_INCOMPLETE");
  if (selected === "supabase" && (!hasUrl || !hasKey))
    throw Error("SUPABASE_CONFIGURATION_INCOMPLETE");
  if (selected !== "auto") return selected as DataProvider;
  return hasUrl && hasKey ? "supabase" : "sqlite-demo";
}

export function localDemoAllowed(env: PersistenceEnvironment) {
  return (
    dataProvider(env) === "sqlite-demo" &&
    !env.VERCEL &&
    (env.NODE_ENV !== "production" || env.ALLOW_LOCAL_DEMO === "true")
  );
}

export function assertAdapterAvailable(env: PersistenceEnvironment) {
  const provider = dataProvider(env);
  // A MySQL schema and contract are prepared, but no connection is claimed.
  // In particular, never silently write MySQL-selected operations to a demo DB.
  if (provider === "mysql") throw Error("MYSQL_ADAPTER_NOT_CONFIGURED");
  if (provider === "sqlite-demo" && !localDemoAllowed(env))
    throw Error("LOCAL_DEMO_DISABLED");
  return provider;
}
