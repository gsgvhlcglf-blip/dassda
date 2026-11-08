import "server-only";
import { repository } from "../server/persistence/index";
import type { Repositories } from "../server/persistence/contracts";

export const getRows: Repositories["catalog"]["getRows"] = async (...args) =>
  (await repository("catalog")).getRows(...args);

import type { Catalog } from "./types";
import { publicCatalog } from "./catalog-visibility";
export async function getCatalog(): Promise<Catalog> {
  const keys = [
    "brands",
    "models",
    "generations",
    "model_years",
    "products",
    "variants",
    "product_images",
    "compatibility",
    "categories",
    "content",
  ] as (keyof Catalog)[];
  const values = await Promise.all(keys.map((k) => getRows(k)));
  const c = Object.fromEntries(keys.map((k, i) => [k, values[i]])) as Catalog;
  return publicCatalog(c);
}
