import type { Catalog, Compatibility } from "./types";

export type CompatibilityInput = {
  id: string;
  brand_id: string;
  model_id: string;
  generation_id: string | null;
  year_from: number | "";
  year_to: number | "";
};

export function compatibilityInputs(
  c: Catalog,
  productId: string,
): CompatibilityInput[] {
  return c.compatibility
    .filter((f) => f.product_id === productId)
    .map((f) => ({
      id: f.id,
      brand_id: c.models.find((m) => m.id === f.model_id)?.brand_id || "",
      model_id: f.model_id,
      generation_id: f.generation_id,
      year_from: f.year_from,
      year_to: f.year_to,
    }));
}

/** Only replace this product's fitments; reject forged IDs and invalid selections. */
export function applyProductCompatibility(
  c: Catalog,
  productId: string,
  input: unknown,
): Catalog {
  if (!c.products.some((p) => p.id === productId))
    throw Error("Ürün bulunamadı.");
  if (!Array.isArray(input) || input.length > 500)
    throw Error("En fazla 500 uyumluluk satırı ekleyin.");
  const rows: Compatibility[] = [];
  const unchanged = new Set<string>();
  for (const value of input) {
    if (
      !value ||
      typeof value !== "object" ||
      typeof value.id !== "string" ||
      typeof value.brand_id !== "string" ||
      typeof value.model_id !== "string" ||
      (value.generation_id !== null && typeof value.generation_id !== "string")
    )
      throw Error("Uyumluluk satırı geçersiz.");
    const id = value.id || crypto.randomUUID();
    const old = c.compatibility.find((f) => f.id === id);
    if (
      !/^[a-zA-Z0-9_-]{1,120}$/.test(id) ||
      rows.some((f) => f.id === id) ||
      (old && old.product_id !== productId) ||
      (value.product_id !== undefined && value.product_id !== productId)
    )
      throw Error("Uyumluluk kaydı geçersiz veya başka bir ürüne ait.");
    const model = c.models.find(
      (m) => m.id === value.model_id && m.brand_id === value.brand_id,
    );
    if (!model) throw Error("Uyumlu marka ve motosiklet modelini seçin.");
    if (
      ![value.year_from, value.year_to].every(
        (y) =>
          typeof y === "number" &&
          Number.isInteger(y) &&
          y >= 1900 &&
          y <= 2100,
      ) ||
      value.year_from > value.year_to
    )
      throw Error(
        "Uyumluluk için başlangıç ve bitiş yıllarını küçükten büyüğe seçin.",
      );
    const g = c.generations.find(
      (g) => g.id === value.generation_id && g.model_id === model.id,
    );
    if (
      value.generation_id &&
      (!g || value.year_from < g.start_year || value.year_to > g.end_year)
    )
      throw Error("Seçilen yıllar motosikletin seçili nesliyle eşleşmiyor.");
    const row: Compatibility = {
      id,
      product_id: productId,
      model_id: model.id,
      generation_id: value.generation_id,
      year_from: value.year_from,
      year_to: value.year_to,
    };
    const same =
      old &&
      old.model_id === row.model_id &&
      old.generation_id === row.generation_id &&
      old.year_from === row.year_from &&
      old.year_to === row.year_to;
    if (same) unchanged.add(id);
    else
      for (const year of [row.year_from, row.year_to])
        if (
          !c.model_years.some(
            (y) =>
              y.model_id === model.id &&
              y.year === year &&
              (!row.generation_id || y.generation_id === row.generation_id),
          )
        )
          throw Error(
            "Seçilen yıl modelin üretim yıllarında bulunmuyor. Önce motosikletin yıl tanımlarını ekleyin.",
          );
    rows.push(row);
  }
  for (let i = 0; i < rows.length; i++)
    for (let j = i + 1; j < rows.length; j++) {
      const a = rows[i],
        b = rows[j];
      if (
        a.model_id === b.model_id &&
        a.year_from <= b.year_to &&
        b.year_from <= a.year_to &&
        !(unchanged.has(a.id) && unchanged.has(b.id))
      )
        throw Error(
          "Aynı model için yıl aralıkları çakışıyor. Mevcut satırı düzenleyin veya ayrı, çakışmayan yıllar seçin.",
        );
    }
  const next = structuredClone(c),
    byId = new Map(rows.map((r) => [r.id, r]));
  next.compatibility = next.compatibility
    .filter((f) => f.product_id !== productId || byId.has(f.id))
    .map((f) => (f.product_id === productId ? byId.get(f.id)! : f));
  next.compatibility.push(
    ...rows.filter((r) => !c.compatibility.some((f) => f.id === r.id)),
  );
  return next;
}
