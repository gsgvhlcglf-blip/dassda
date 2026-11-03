import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { seed } from "../src/lib/seed";
const data = structuredClone(seed);
function inline(url: string) {
  if (!url.startsWith("/images/")) return url;
  const file = path.join("public", url);
  const type = file.endsWith(".svg")
    ? "image/svg+xml"
    : file.endsWith(".webp")
      ? "image/webp"
      : "image/png";
  return `data:${type};base64,${readFileSync(file).toString("base64")}`;
}
for (const r of data.product_images) r.url = inline(r.url);
for (const r of data.models) r.image = inline(r.image);
const json = JSON.stringify(data).replaceAll("<", "\\u003c");
writeFileSync(
  "docs/panel.html",
  readFileSync("quick-panel/template.html", "utf8").replace(
    "__SEED__",
    () => json,
  ),
);
console.log("Self-contained catalog workspace built: docs/panel.html");
