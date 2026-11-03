import "server-only";
import { isLive, rowsLocal } from "./database";
import { supabase } from "./supabase";
import type { Catalog, Table } from "./types";
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
  c.products = c.products.filter((p) => p.published);
  const visible = new Set(c.products.map((p) => p.id));
  c.variants = c.variants.filter((v) => visible.has(v.product_id));
  c.product_images = c.product_images.filter((i) => visible.has(i.product_id));
  c.compatibility = c.compatibility.filter((f) => visible.has(f.product_id));
  return c;
}
