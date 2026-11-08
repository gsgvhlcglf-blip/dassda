import type { Catalog, Generation, Lang } from "./types";

export function currentModelYear(now = new Date()) {
  return Number(
    new Intl.DateTimeFormat("en", {
      year: "numeric",
      timeZone: "Europe/Istanbul",
    }).format(now),
  );
}
export function generationRangeLabel(
  g: Pick<Generation, "start_year" | "end_year" | "ongoing">,
  lang: Lang = "tr",
) {
  const present = { tr: "Günümüz", en: "Present", ru: "Настоящее время" };
  return `${g.start_year}–${g.ongoing ? present[lang] : g.end_year}`;
}

// Stable view IDs for newly elapsed years, independent of browser/server clocks.
function ongoingYearId(modelId: string, year: number) {
  const source = `${modelId}:${year}`;
  const hashes = [0x811c9dc5, 0x9e3779b9, 0x85ebca6b, 0xc2b2ae35];
  for (const ch of source)
    for (let i = 0; i < hashes.length; i++)
      hashes[i] = Math.imul(hashes[i] ^ ch.charCodeAt(0), 16777619) >>> 0;
  return `ongoing-${hashes.map((n) => n.toString(16).padStart(8, "0")).join("")}-${year}`;
}

/** Resolve an owner-declared ongoing generation; never extend any product fitment. */
export function resolveOngoingYears(
  catalog: Catalog,
  year = currentModelYear(),
): Catalog {
  if (!catalog.generations.some((g) => g.ongoing === true)) return catalog;
  const next = {
    ...catalog,
    generations: catalog.generations.map((g) => ({ ...g })),
    model_years: [...catalog.model_years],
  };
  for (const g of next.generations) {
    if (g.ongoing !== true) continue;
    g.end_year = Math.max(g.start_year, year);
    for (let y = g.start_year; y <= g.end_year; y++) {
      if (
        next.model_years.some(
          (row) => row.model_id === g.model_id && row.year === y,
        )
      )
        continue;
      next.model_years.push({
        id: ongoingYearId(g.model_id, y),
        model_id: g.model_id,
        generation_id: g.id,
        year: y,
      });
    }
  }
  return next;
}

export type GenerationInput = {
  id: string;
  name: string;
  start_year: number | "";
  end_year: number | "";
  ongoing?: boolean;
};

export function generationInputs(
  c: Pick<Catalog, "generations">,
  modelId: string,
): GenerationInput[] {
  return c.generations
    .filter((g) => g.model_id === modelId)
    .map(({ id, name, start_year, end_year, ongoing }) => ({
      id,
      name,
      start_year,
      end_year: ongoing ? currentModelYear() : end_year,
      ongoing: ongoing === true,
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
    if (value.ongoing !== undefined && typeof value.ongoing !== "boolean")
      throw Error("Günümüz seçimi geçersiz.");
    const endYear =
      value.ongoing === true ? currentModelYear() : value.end_year;
    if (
      ![value.start_year, endYear].every(
        (y) =>
          typeof y === "number" &&
          Number.isInteger(y) &&
          y >= 1900 &&
          y <= 2100,
      ) ||
      value.start_year > endYear
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
      end_year: endYear,
      ...(value.ongoing !== undefined ? { ongoing: value.ongoing } : {}),
    });
  }
  groups.sort((a, b) => a.start_year - b.start_year || a.end_year - b.end_year);
  if (groups.some((g, index) => g.ongoing && index !== groups.length - 1))
    throw Error(
      "Günümüz seçimi yalnızca son nesilde kullanılabilir. Önce önceki neslin bitiş yılını belirtin.",
    );
  const unchanged =
    groups.length === previous.length &&
    groups.every((g) =>
      previous.some(
        (p) =>
          p.id === g.id &&
          p.start_year === g.start_year &&
          p.end_year === g.end_year &&
          !!p.ongoing === !!g.ongoing,
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
      old?.start_year === g.start_year &&
      old?.end_year === g.end_year &&
      !!old?.ongoing === !!g.ongoing;
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
