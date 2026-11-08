import type { Catalog } from "./types";
import { resolveOngoingYears } from "./model-generations";

// Older owner drafts have no model publication flag; keep those models visible.
// Return a filtered view without changing the editable catalog or its relations.
export function publicCatalog(c: Catalog): Catalog {
  c = resolveOngoingYears(c);
  const models = c.models.filter((m) => m.published !== false);
  const products = c.products.filter((p) => p.published);
  const modelIds = new Set(models.map((m) => m.id));
  const productIds = new Set(products.map((p) => p.id));
  return {
    ...c,
    models,
    products,
    generations: c.generations.filter((g) => modelIds.has(g.model_id)),
    model_years: c.model_years.filter((y) => modelIds.has(y.model_id)),
    variants: c.variants.filter((v) => productIds.has(v.product_id)),
    product_images: c.product_images.filter((i) =>
      productIds.has(i.product_id),
    ),
    compatibility: c.compatibility.filter(
      (f) => modelIds.has(f.model_id) && productIds.has(f.product_id),
    ),
  };
}
