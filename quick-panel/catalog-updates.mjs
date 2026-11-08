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
 * @param {{id:string,table:string,recordId:string,changes:Record<string,unknown>,createIfMissing?:boolean,replacements?:{field:string,lang:string,from:string,to:string}[]}[]} updates
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
    if (update.createIfMissing && update.table !== "content")
      throw new Error(
        "Only public content pages can be created by a copy update",
      );
    const row = next[update.table]?.find((r) => r.id === update.recordId);
    if (row) {
      for (const replacement of update.replacements || []) {
        if (
          update.table !== "content" ||
          !["title", "body"].includes(replacement.field) ||
          !["tr", "en", "ru"].includes(replacement.lang) ||
          typeof replacement.from !== "string" ||
          !replacement.from ||
          typeof replacement.to !== "string"
        )
          throw new Error("Invalid content replacement");
        const field = row[replacement.field];
        if (field && typeof field[replacement.lang] === "string")
          field[replacement.lang] = field[replacement.lang].replaceAll(
            replacement.from,
            replacement.to,
          );
      }
      mergeFields(row, update.changes);
      changed = true;
    } else if (update.createIfMissing) {
      const page = { id: update.recordId };
      mergeFields(page, update.changes);
      const localized = (value) =>
        value &&
        typeof value === "object" &&
        ["tr", "en", "ru"].every(
          (lang) =>
            typeof value[lang] === "string" && value[lang].length <= 12000,
        );
      if (
        Object.keys(page).some(
          (key) => !["id", "key", "title", "body"].includes(key),
        ) ||
        !/^[a-z0-9][a-z0-9-]{0,119}$/.test(page.id) ||
        typeof page.key !== "string" ||
        !/^[a-z0-9][a-z0-9-]{0,119}$/.test(page.key) ||
        !localized(page.title) ||
        !localized(page.body)
      )
        throw new Error("Invalid public content page");
      if (!next.content.some((existing) => existing.key === page.key)) {
        next.content.push(page);
        changed = true;
      }
    }
    applied.add(update.id);
  }
  return { catalog: next, appliedIds: [...applied], changed };
}
