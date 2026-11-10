import type { Catalog } from "./types";
import {
  motorcycleRangeFitment,
  resolveMotorcycleRange,
  yearRangeText,
} from "./motorcycle-selection";

/** Never infer compatibility from a model name or an arbitrary URL year. */
export function selectedFitment(
  c: Catalog,
  productId: string,
  query: Record<string, string>,
  savedPath = "",
) {
  let { brand, model, year, range } = query;
  if (!model && savedPath) {
    const [section, brandSlug, modelSlug, token] = savedPath
      .split("/")
      .filter(Boolean);
    const b = c.brands.find((b) => b.slug === brandSlug);
    const m = c.models.find(
      (m) => m.brand_id === b?.id && m.slug === modelSlug,
    );
    if (section === "motosikletler" && m && token) {
      brand = b!.id;
      model = m.id;
      if (/^\d{4}$/.test(token)) year = token;
      else range = token;
    }
  }
  const m = c.models.find((m) => m.id === model);
  const b = c.brands.find((b) => b.id === m?.brand_id);
  if (
    !m ||
    !b ||
    (brand && brand !== b.id) ||
    (!year && !range) ||
    (year && range)
  )
    return null;
  const selection = resolveMotorcycleRange(c, m.id, year || range);
  if (!selection) return null;
  const years = motorcycleRangeFitment(c, m.id, selection).get(productId) || [];
  return {
    label: `${b.name} ${m.name} · ${selection.label}`,
    generation: selection.name,
    status:
      years.length === 0
        ? "none"
        : years.length === selection.totalYears
          ? "full"
          : "partial",
    years: yearRangeText(years),
    href: `/motosikletler/${b.slug}/${m.slug}/${selection.token}`,
  };
}
