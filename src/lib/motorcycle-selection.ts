import type { Catalog, Lang } from "./types";
import { generationRangeLabel } from "./model-generations";

export type MotorcycleRange = {
  token: string;
  label: string;
  name: string;
  years: number[];
  totalYears: number;
};

export function yearRangeText(years: number[]) {
  const ordered = [...new Set(years)].sort((a, b) => a - b);
  const groups: number[][] = [];
  for (const year of ordered) {
    const last = groups.at(-1);
    if (last && last.at(-1) === year - 1) last.push(year);
    else groups.push([year]);
  }
  return groups
    .map((group) =>
      group.length === 1 ? String(group[0]) : `${group[0]}–${group.at(-1)}`,
    )
    .join(", ");
}

export function motorcycleRanges(
  c: Catalog,
  modelId: string,
  lang: Lang = "tr",
): MotorcycleRange[] {
  const years = c.model_years.filter((year) => year.model_id === modelId);
  const assigned = new Set<number>();
  const ranges: MotorcycleRange[] = [];
  for (const generation of c.generations.filter(
    (g) => g.model_id === modelId,
  )) {
    const members = years
      .filter(
        (year) =>
          year.generation_id === generation.id &&
          year.year >= generation.start_year &&
          year.year <= generation.end_year,
      )
      .map((year) => year.year);
    if (!members.length) continue;
    members.forEach((year) => assigned.add(year));
    ranges.push({
      token: generation.ongoing
        ? `${generation.start_year}-gunumuz`
        : `${generation.start_year}-${generation.end_year}`,
      label:
        generation.start_year === generation.end_year && !generation.ongoing
          ? String(generation.start_year)
          : generationRangeLabel(generation, lang),
      name: generation.name,
      years: members.sort((a, b) => a - b),
      totalYears: generation.end_year - generation.start_year + 1,
    });
  }
  // Legacy years without a generation remain selectable as contiguous ranges.
  const unassigned = years
    .filter((year) => !assigned.has(year.year))
    .map((year) => year.year)
    .sort((a, b) => a - b);
  const groups: number[][] = [];
  for (const year of unassigned) {
    const last = groups.at(-1);
    if (last && last.at(-1) === year - 1) last.push(year);
    else groups.push([year]);
  }
  ranges.push(
    ...groups.map((members) => ({
      token: `${members[0]}-${members.at(-1)}`,
      label: yearRangeText(members),
      name: "",
      years: members,
      totalYears: members.length,
    })),
  );
  return ranges.sort((a, b) => b.years.at(-1)! - a.years.at(-1)!);
}

export function resolveMotorcycleRange(
  c: Catalog,
  modelId: string,
  token: string,
  lang: Lang = "tr",
): MotorcycleRange | null {
  const range = motorcycleRanges(c, modelId, lang).find(
    (item) => item.token === token,
  );
  if (range) return range;
  // Existing exact-year links keep their original compatibility semantics.
  if (!/^\d{4}$/.test(token)) return null;
  const year = c.model_years.find(
    (row) => row.model_id === modelId && row.year === Number(token),
  );
  return year
    ? { token, label: token, name: "", years: [year.year], totalYears: 1 }
    : null;
}

/** Match only explicitly stored fitments, including their generation restriction. */
export function motorcycleRangeFitment(
  c: Catalog,
  modelId: string,
  range: MotorcycleRange,
) {
  const result = new Map<string, number[]>();
  if (
    !c.models.some((model) => model.id === modelId && model.published !== false)
  )
    return result;
  const years = c.model_years.filter(
    (row) => row.model_id === modelId && range.years.includes(row.year),
  );
  for (const fit of c.compatibility.filter((row) => row.model_id === modelId)) {
    const matched = years
      .filter(
        (year) =>
          year.year >= fit.year_from &&
          year.year <= fit.year_to &&
          (!fit.generation_id || fit.generation_id === year.generation_id),
      )
      .map((year) => year.year);
    if (matched.length)
      result.set(
        fit.product_id,
        [...new Set([...(result.get(fit.product_id) || []), ...matched])].sort(
          (a, b) => a - b,
        ),
      );
  }
  return result;
}
