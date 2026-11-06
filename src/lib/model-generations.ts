import type { Catalog, Generation } from "./types";

export type GenerationInput = {
  id: string;
  name: string;
  start_year: number | "";
  end_year: number | "";
};

export function generationInputs(
  c: Pick<Catalog, "generations">,
  modelId: string,
): GenerationInput[] {
  return c.generations
    .filter((g) => g.model_id === modelId)
    .map(({ id, name, start_year, end_year }) => ({
      id,
      name,
      start_year,
      end_year,
    }));
}

/** Apply a model's year groups together; never infer extra product compatibility. */
export function applyModelGenerations(
  c: Catalog,
  modelId: string,
  input: unknown,
): Catalog {
  if (!Array.isArray(input) || input.length > 100)
    throw Error("En fazla 100 nesil / yıl aralığı ekleyin.");
  if (!c.models.some((m) => m.id === modelId))
    throw Error("Motosiklet bulunamadı.");
  const previous = c.generations.filter((g) => g.model_id === modelId);
  const groups: Generation[] = [];
  for (const value of input) {
    if (
      !value ||
      typeof value !== "object" ||
      typeof value.id !== "string" ||
      typeof value.name !== "string"
    )
      throw Error("Nesil bilgileri geçersiz.");
    if (
      !value.name.trim() &&
      value.start_year === "" &&
      value.end_year === "" &&
      !previous.some((g) => g.id === value.id)
    )
      continue;
    if (!value.name.trim() || value.name.trim().length > 200)
      throw Error(
        "Her yıl aralığı için nesil açıklaması girin (en fazla 200 karakter).",
      );
    if (
      ![value.start_year, value.end_year].every(
        (y) =>
          typeof y === "number" &&
          Number.isInteger(y) &&
          y >= 1900 &&
          y <= 2100,
      ) ||
      value.start_year > value.end_year
    )
      throw Error(
        "Başlangıç ve bitiş yıllarını 1900–2100 arasında, küçükten büyüğe girin.",
      );
    const id = value.id || crypto.randomUUID();
    if (
      !/^[a-zA-Z0-9_-]{1,120}$/.test(id) ||
      groups.some((g) => g.id === id) ||
      c.generations.some((g) => g.id === id && g.model_id !== modelId)
    )
      throw Error("Nesil kaydı geçersiz veya başka bir modele ait.");
    groups.push({
      id,
      model_id: modelId,
      name: value.name.trim(),
      start_year: value.start_year,
      end_year: value.end_year,
    });
  }
  groups.sort((a, b) => a.start_year - b.start_year || a.end_year - b.end_year);
  const unchanged =
    groups.length === previous.length &&
    groups.every((g) =>
      previous.some(
        (p) =>
          p.id === g.id &&
          p.start_year === g.start_year &&
          p.end_year === g.end_year,
      ),
    );
  const next = structuredClone(c);
  const byId = new Map(groups.map((g) => [g.id, g]));
  next.generations = next.generations
    .filter((g) => g.model_id !== modelId || byId.has(g.id))
    .map((g) => (g.model_id === modelId ? byId.get(g.id)! : g));
  next.generations.push(
    ...groups.filter((g) => !previous.some((p) => p.id === g.id)),
  );
  // Names/visibility/photo edits keep sparse years, empty legacy groups and IDs intact.
  if (unchanged) return next;
  for (let i = 1; i < groups.length; i++)
    if (groups[i].start_year <= groups[i - 1].end_year)
      throw Error(
        "Yıl aralıkları çakışıyor. Her üretim yılı yalnızca bir nesle ait olmalı.",
      );
  const oldYears = c.model_years.filter((y) => y.model_id === modelId);
  next.model_years = next.model_years.filter((y) => y.model_id !== modelId);
  for (const g of groups) {
    const old = previous.find((p) => p.id === g.id);
    const sameBounds =
      old?.start_year === g.start_year && old?.end_year === g.end_year;
    const years = sameBounds
      ? oldYears.filter((y) => y.generation_id === g.id).map((y) => y.year)
      : Array.from(
          { length: g.end_year - g.start_year + 1 },
          (_, i) => g.start_year + i,
        );
    for (const year of years)
      next.model_years.push({
        id: oldYears.find((y) => y.year === year)?.id || crypto.randomUUID(),
        model_id: modelId,
        generation_id: g.id,
        year,
      });
  }
  const fits = c.compatibility.filter((f) => f.model_id === modelId);
  next.compatibility = next.compatibility.filter((f) => f.model_id !== modelId);
  const keys = new Set<string>();
  for (const f of fits) {
    const intersections = groups
      .map((g) => ({
        g,
        from: Math.max(g.start_year, f.year_from),
        to: Math.min(g.end_year, f.year_to),
      }))
      .filter((r) => r.from <= r.to);
    let cursor = f.year_from;
    for (const r of intersections) {
      if (r.from > cursor) break;
      cursor = r.to + 1;
    }
    if (cursor <= f.year_to)
      throw Error(
        `Mevcut parça uyumluluğu ${f.year_from}–${f.year_to} yıllarını kullanıyor. Bu yılları kapsayın veya önce ilgili uyumluluğu düzenleyin.`,
      );
    const segments = f.generation_id
      ? intersections
      : [{ g: null, from: f.year_from, to: f.year_to }];
    for (const [i, r] of segments.entries()) {
      const key = f.product_id + ":" + r.from + ":" + r.to;
      if (keys.has(key)) continue;
      keys.add(key);
      next.compatibility.push({
        ...f,
        id: i === 0 ? f.id : crypto.randomUUID(),
        generation_id: r.g?.id || null,
        year_from: r.from,
        year_to: r.to,
      });
    }
  }
  return next;
}
