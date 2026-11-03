import { writeFileSync } from "node:fs";
import { seed } from "../src/lib/seed";
const order = [
  "brands",
  "models",
  "generations",
  "model_years",
  "categories",
  "products",
  "variants",
  "product_images",
  "compatibility",
  "content",
] as const;
function literal(v: unknown) {
  return v === null
    ? "NULL"
    : typeof v === "boolean"
      ? String(v)
      : typeof v === "number"
        ? String(v)
        : `'${(typeof v === "object" ? JSON.stringify(v) : String(v)).replaceAll("'", "''")}'`;
}
let sql =
  "-- Clearly labeled demo data. These are not verified fitments or actual stock.\nBEGIN;\n";
for (const t of order)
  for (const row of seed[t])
    sql += `INSERT INTO public.${t} (${Object.keys(row).join(",")}) VALUES (${Object.values(row).map(literal).join(",")}) ON CONFLICT(id) DO NOTHING;\n`;
sql += "COMMIT;\n";
writeFileSync("supabase/seed.sql", sql);
