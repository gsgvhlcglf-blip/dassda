"use client";
import type { Lang, Product } from "@/lib/types";
import { money } from "@/lib/i18n";
import { salePrice } from "@/lib/product-commerce";
export function ProductPrice({
  product,
  lang,
}: {
  product: Product;
  lang: Lang;
}) {
  const percent = product.discount_percent ?? 0;
  return (
    <span className="product-price">
      {percent > 0 && <del>{money(product.price, lang)}</del>}
      <span>{money(salePrice(product), lang)}</span>
      {percent > 0 && (
        <small className="discount-badge">
          %{new Intl.NumberFormat(lang).format(percent)}
        </small>
      )}
    </span>
  );
}
