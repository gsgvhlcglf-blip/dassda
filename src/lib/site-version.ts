import { z } from "zod";
import { schemas } from "./validation";
import type { Catalog, Row } from "./types";
export const catalogTables = [
  "brands",
  "categories",
  "models",
  "generations",
  "model_years",
  "products",
  "variants",
  "product_images",
  "compatibility",
  "content",
] as const;
export type SiteSnapshot = {
  catalog: Catalog;
  design: import("./visual").VisualDesign;
};
export type SiteVersion = {
  id: string;
  created_at: string;
  label: string;
  kind: "published" | "draft_backup";
  snapshot: SiteSnapshot;
};
export type Workspace = {
  revision: number;
  snapshot: SiteSnapshot;
  published_id: string | null;
  history: Omit<SiteVersion, "snapshot">[];
};
const brands = z.object({
  id: z.enum(["ducati", "bmw", "yamaha"]),
  slug: z.enum(["ducati", "bmw", "yamaha"]),
  name: z.string().min(1).max(100),
  position: z.number().int(),
});
export function validateCatalog(value: unknown): Catalog {
  if (!value || typeof value !== "object") throw Error("Katalog geçersiz.");
  const result = {} as Catalog;
  for (const table of catalogTables) {
    const rows = (value as Record<string, unknown>)[table];
    if (!Array.isArray(rows) || rows.length > 10000)
      throw Error("Katalog tablosu geçersiz: " + table);
    const schema = table === "brands" ? brands : schemas[table];
    (result[table] as Row[]) = rows.map((row) => schema.parse(row) as Row);
    const ids = new Set(result[table].map((r) => r.id));
    if (ids.size !== result[table].length)
      throw Error("Tekrarlanan kayıt: " + table);
  }
  if (
    result.brands.length !== 3 ||
    !["ducati", "bmw", "yamaha"].every((id) =>
      result.brands.some((b) => b.id === id && b.slug === id),
    )
  )
    throw Error("Üç motosiklet markası korunmalıdır.");
  const has = (table: keyof Catalog, id: unknown) =>
    result[table].some((r) => r.id === id);
  const unique = (rows: Row[], key: (r: Row) => string) => {
    const keys = rows.map(key);
    if (new Set(keys).size !== keys.length)
      throw Error("Tekrarlanan isim, SKU, adres veya yıl.");
  };
  unique(result.models, (r) => r.brand_id + ":" + r.slug);
  unique(result.model_years, (r) => r.model_id + ":" + r.year);
  for (const table of ["products", "categories"] as const)
    unique(result[table], (r) => String(r.slug));
  unique(result.products, (r) => String(r.sku));
  unique(result.variants, (r) => String(r.sku));
  unique(result.content, (r) => String(r.key));
  for (const row of result.models)
    if (!has("brands", row.brand_id)) throw Error("Modelin markası geçersiz.");
  for (const row of result.generations)
    if (!has("models", row.model_id)) throw Error("Neslin modeli geçersiz.");
  for (const row of result.products)
    if (!has("categories", row.category_id))
      throw Error("Ürünün kategorisi geçersiz.");
  for (const table of ["variants", "product_images", "compatibility"] as const)
    for (const row of result[table])
      if (!has("products", row.product_id))
        throw Error("Bağlı ürün bulunamadı.");
  for (const row of [...result.model_years, ...result.compatibility]) {
    if (!has("models", row.model_id))
      throw Error("Bağlı motosiklet bulunamadı.");
    const g = result.generations.find((g) => g.id === row.generation_id);
    if (
      row.generation_id &&
      (!g ||
        g.model_id !== row.model_id ||
        Number(row.year ?? row.year_from) < g.start_year ||
        Number(row.year ?? row.year_to) > g.end_year)
    )
      throw Error("Yıl veya uyumluluk, seçili nesille eşleşmiyor.");
  }
  return result;
}
export function editCatalog(
  catalog: Catalog,
  table: keyof Catalog,
  action: string,
  record: Row,
) {
  if (table === "brands") throw Error("Markalar değiştirilemez.");
  const next = structuredClone(catalog),
    index = (next[table] as Row[]).findIndex((r) => r.id === record.id);
  if (action === "insert") {
    if (index !== -1) throw Error("Bu kayıt zaten var.");
    (next[table] as Row[]).push(record);
  } else if (action === "update") {
    if (index === -1) throw Error("Kayıt bulunamadı.");
    (next[table] as Row[])[index] = record;
  } else if (action === "delete") {
    if (index === -1) throw Error("Kayıt bulunamadı.");
    (next[table] as Row[]) = (next[table] as Row[]).filter(
      (r) => r.id !== record.id,
    );
    if (table === "products")
      for (const child of [
        "variants",
        "product_images",
        "compatibility",
      ] as const)
        next[child] = next[child].filter(
          (r) => r.product_id !== record.id,
        ) as never;
    if (table === "models")
      for (const child of [
        "generations",
        "model_years",
        "compatibility",
      ] as const)
        next[child] = next[child].filter(
          (r) => r.model_id !== record.id,
        ) as never;
  } else throw Error("İşlem geçersiz.");
  return validateCatalog(next);
}
