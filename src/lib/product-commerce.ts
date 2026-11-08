import type { Catalog, Product, Variant } from "./types";

/** All catalog products are made to order; legacy stock columns are not limits. */
export const maxLineQuantity = 99;
export function salePrice(
  product: Pick<Product, "price" | "discount_percent">,
) {
  const baseMinor = Math.round(product.price * 100);
  const discount = Math.round((product.discount_percent ?? 0) * 100);
  return Math.round((baseMinor * (10000 - discount)) / 10000) / 100;
}
export function variantAvailable(product: Product, variant: Variant) {
  return (
    variant.product_id === product.id &&
    (variant.finish === "gloss" ||
      (variant.finish === "matte" && product.matte_enabled === true))
  );
}
export function productVariants(product: Product, variants: Variant[]) {
  return variants
    .filter((v) => variantAvailable(product, v))
    .sort(
      (a, b) => Number(a.finish === "matte") - Number(b.finish === "matte"),
    );
}
export function withProductFinishes(
  catalog: Catalog,
  productId: string,
): Catalog {
  const next = structuredClone(catalog);
  const product = next.products.find((p) => p.id === productId);
  if (!product) return next;
  for (const finish of product.matte_enabled ? ["gloss", "matte"] : ["gloss"]) {
    if (
      next.variants.some(
        (v) => v.product_id === productId && v.finish === finish,
      )
    )
      continue;
    next.variants.push({
      id: crypto.randomUUID(),
      product_id: productId,
      name:
        finish === "gloss"
          ? { tr: "Parlak vernik", en: "Gloss clear coat", ru: "Глянцевый лак" }
          : { tr: "Mat vernik", en: "Matte clear coat", ru: "Матовый лак" },
      sku: product.sku + (finish === "gloss" ? "-G" : "-M"),
      price: product.price,
      stock: 0,
      finish,
    });
  }
  // Disabled matte rows stay intact for old orders; availability follows the flag.
  return next;
}
