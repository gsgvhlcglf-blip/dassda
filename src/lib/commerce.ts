import type { Catalog, CartLine, Product } from "./types";
export function compatibleProducts(
  c: Catalog,
  modelId: string,
  year: number,
): Product[] {
  const y = c.model_years.find(
    (y) => y.model_id === modelId && y.year === year,
  );
  if (!y) return [];
  const ids = new Set(
    c.compatibility
      .filter(
        (f) =>
          f.model_id === modelId &&
          year >= f.year_from &&
          year <= f.year_to &&
          (!f.generation_id || f.generation_id === y.generation_id),
      )
      .map((f) => f.product_id),
  );
  return c.products.filter((p) => p.published && ids.has(p.id));
}
export function quote(c: Catalog, lines: CartLine[]) {
  if (!lines.length || lines.length > 50) throw new Error("EMPTY_CART");
  const combined = new Map<string, CartLine>();
  for (const l of lines) {
    if (!Number.isInteger(l.quantity) || l.quantity < 1 || l.quantity > 99)
      throw new Error("INVALID_QUANTITY");
    const key = l.variantId;
    const old = combined.get(key);
    if (old && old.productId !== l.productId)
      throw new Error("INVALID_VARIANT");
    combined.set(key, { ...l, quantity: l.quantity + (old?.quantity ?? 0) });
  }
  const items = [...combined.values()].map((l) => {
    const p = c.products.find((p) => p.id === l.productId && p.published),
      v = c.variants.find(
        (v) => v.id === l.variantId && v.product_id === l.productId,
      );
    if (!p || !v) throw new Error("INVALID_VARIANT");
    if (l.quantity > v.stock || l.quantity > p.stock)
      throw new Error("OUT_OF_STOCK");
    return { ...l, product: p, variant: v, unit_price: v.price };
  });
  for (const p of new Set(items.map((i) => i.product.id))) {
    if (
      items
        .filter((i) => i.product.id === p)
        .reduce((a, i) => a + i.quantity, 0) >
      items.find((i) => i.product.id === p)!.product.stock
    )
      throw new Error("OUT_OF_STOCK");
  }
  return {
    items,
    total:
      Math.round(
        items.reduce((sum, i) => sum + i.unit_price * i.quantity, 0) * 100,
      ) / 100,
    demo: items.some((i) => i.product.demo),
  };
}
