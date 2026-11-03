const allowedTables = new Set([
  "products",
  "variants",
  "models",
  "generations",
  "model_years",
  "compatibility",
  "product_images",
  "categories",
  "content",
]);
const forbidden = new Set(["__proto__", "constructor", "prototype", "id"]);
function mergeFields(record, changes) {
  for (const [key, value] of Object.entries(changes)) {
    if (forbidden.has(key)) throw new Error("Invalid catalog update field");
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const previous = record[key];
      record[key] =
        previous && typeof previous === "object" && !Array.isArray(previous)
          ? { ...previous }
          : {};
      mergeFields(record[key], value);
    } else record[key] = value;
  }
}
/**
 * Apply requested public catalog edits once without resetting other drafts.
 * @template T
 * @param {T} catalog
 * @param {{id:string,table:string,recordId:string,changes:Record<string,unknown>}[]} updates
 * @param {string[]} [previousIds]
 */
export function applyCatalogUpdates(catalog, updates, previousIds = []) {
  const next = structuredClone(catalog),
    applied = new Set(previousIds);
  let changed = false;
  for (const update of updates) {
    if (
      !update ||
      typeof update.id !== "string" ||
      !allowedTables.has(update.table) ||
      typeof update.recordId !== "string" ||
      !update.changes ||
      typeof update.changes !== "object"
    )
      throw new Error("Invalid catalog update");
    if (applied.has(update.id)) continue;
    const row = next[update.table]?.find((r) => r.id === update.recordId);
    if (row) {
      mergeFields(row, update.changes);
      changed = true;
    }
    applied.add(update.id);
  }
  return { catalog: next, appliedIds: [...applied], changed };
}
