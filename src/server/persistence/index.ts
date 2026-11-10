import "server-only";
import { assertAdapterAvailable } from "./config";
import type { AdapterLoaders, Repositories } from "./contracts";

// Existing implementations retain their transactions, RLS and ownership checks.
// Register a complete MySQL loader set here when the hosting work is authorized.
const existing: AdapterLoaders = {
  invoices: () => import("./adapters/existing/invoices"),
  notifications: () => import("./adapters/existing/notifications"),
  catalog: () => import("./adapters/existing/catalog"),
  workspace: () => import("./adapters/existing/workspace"),
  requests: () => import("./adapters/existing/requests"),
  analytics: () => import("./adapters/existing/analytics"),
  payments: () => import("./adapters/existing/payments"),
  identity: () => import("./adapters/existing/identity"),
  orders: () => import("./adapters/existing/orders"),
  media: () => import("./adapters/existing/media"),
};

export async function repository<K extends keyof Repositories>(
  name: K,
): Promise<Repositories[K]> {
  assertAdapterAvailable(process.env);
  return existing[name]();
}
