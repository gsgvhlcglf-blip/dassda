import "server-only";
import { isLive, rowsLocal } from "./database";
import { supabase } from "./supabase";
import type { Catalog, Table } from "./types";
import { publicCatalog } from "./catalog-visibility";
export async function getRows(table: Table) {
  if (!isLive) return rowsLocal(table);
  const db = await supabase();
  const rows = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await db
      .from(table)
      .select("*")
      .order("id")
      .range(offset, offset + 999);
    if (error) throw new Error(`Database: ${error.message}`);
    rows.push(...data);
    if (data.length < 1000) break;
  }
  return rows;
}
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
