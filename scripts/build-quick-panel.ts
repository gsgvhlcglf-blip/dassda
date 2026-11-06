import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { build } from "esbuild";
import postcss from "postcss";
import tailwindcss from "@tailwindcss/postcss";
import { supportedLanguages } from "../src/lib/settings";
import { seed } from "../src/lib/seed";

async function main() {
  const data = structuredClone(seed);
  function inline(url: string) {
    if (!url.startsWith("/images/")) return url;
    const file = path.join("public", url),
      type = file.endsWith(".svg")
        ? "image/svg+xml"
        : file.endsWith(".webp")
          ? "image/webp"
          : "image/png";
    return `data:${type};base64,${readFileSync(file).toString("base64")}`;
  }
  for (const r of data.product_images) r.url = inline(r.url);
  for (const r of data.models) r.image = inline(r.image);
  const result = await build({
    entryPoints: ["quick-panel/site/entry.tsx"],
    bundle: true,
    write: false,
    format: "iife",
    platform: "browser",
    target: ["es2022"],
    minify: true,
    jsx: "automatic",
    define: {
      "process.env.NODE_ENV": '"production"',
      "process.env.NEXT_PUBLIC_SITE_URL": '""',
      "process.env.ENABLE_INDEXING": '"false"',
    },
    plugins: [
      {
        name: "preview-adapters",
        setup(builder) {
          builder.onResolve({ filter: /^next\/(link|image)$/ }, (args) => ({
            path: path.resolve(
              `quick-panel/site/${args.path.split("/")[1]}.tsx`,
            ),
          }));
          builder.onResolve({ filter: /^@\/lib\/cart-store$/ }, () => ({
            path: path.resolve("quick-panel/site/cart.ts"),
          }));
        },
      },
    ],
  });
  const versionLibrary = await build({
    entryPoints: ["src/lib/browser-versions.ts"],
    bundle: true,
    write: false,
    format: "iife",
    globalName: "KZ_VERSIONS",
    platform: "browser",
    target: ["es2022"],
    minify: true,
  });
  const modelLibrary = await build({
    entryPoints: ["quick-panel/model-generations.tsx"],
    bundle: true,
    write: false,
    format: "iife",
    globalName: "KZ_MODELS",
    platform: "browser",
    target: ["es2022"],
    minify: true,
    jsx: "automatic",
    define: { "process.env.NODE_ENV": '"production"' },
  });
  const analyticsBundle = await build({
    entryPoints: ["quick-panel/analytics/entry.tsx"],
    bundle: true,
    write: false,
    format: "iife",
    platform: "browser",
    target: ["es2022"],
    minify: true,
    jsx: "automatic",
    define: { "process.env.NODE_ENV": '\"production\"' },
  });
  const styles = await postcss([
    tailwindcss({ base: process.cwd(), optimize: true }),
  ]).process(
    readFileSync("src/app/globals.css", "utf8").replace(
      '@import "tailwindcss";',
      '@import "tailwindcss" source(none);\n@source "../components";',
    ),
    {
      from: path.resolve("src/app/globals.css"),
    },
  );
  const assets = Object.fromEntries(
    readdirSync("public/images").map((name) => [
      "/images/" + name,
      inline("/images/" + name),
    ]),
  );
  const updates = JSON.parse(
    readFileSync("quick-panel/content-updates.json", "utf8"),
  );
  const version = createHash("sha256")
    .update(result.outputFiles[0].contents)
    .update(styles.css)
    .update(analyticsBundle.outputFiles[0].contents)
    .update(versionLibrary.outputFiles[0].contents)
    .update(modelLibrary.outputFiles[0].contents)
    .update(readFileSync("src/components/model-generations-editor.css"))
    .update(readFileSync("quick-panel/studio/host.js"))
    .update(readFileSync("quick-panel/studio/payments.js"))
    .update(readFileSync("quick-panel/analytics/host.js"))
    .update(readFileSync("quick-panel/site/host.js"))
    .update(readFileSync("quick-panel/site/host.css"))
    .update(readFileSync("quick-panel/site/direct-editor.js"))
    .update(readFileSync("quick-panel/site/customer.js"))
    .update(readFileSync("quick-panel/design.mjs"))
    .update(readFileSync("quick-panel/template.html"))
    .update(readFileSync("quick-panel/catalog-updates.mjs"))
    .update(readFileSync("scripts/build-quick-panel.ts"))
    .update(JSON.stringify(data))
    .update(JSON.stringify(assets))
    .update(JSON.stringify(updates))
    .digest("hex")
    .slice(0, 16);
  const builtAt = new Date().toISOString();
  const preview = {
    built_at: builtAt,
    languages: supportedLanguages,
    version,
    updates,
    js: Buffer.from(result.outputFiles[0].contents).toString("base64"),
    analyticsJs: Buffer.from(analyticsBundle.outputFiles[0].contents).toString(
      "base64",
    ),
    css: Buffer.from(styles.css).toString("base64"),
    assets,
  };
  const json = (v: unknown) =>
    JSON.stringify(v).replaceAll("<", String.fromCharCode(92) + "u003c");
  const template = readFileSync("quick-panel/template.html", "utf8")
    .replace("__SEED__", () => json(data))
    .replace("/*__CATALOG_UPDATES__*/", () =>
      readFileSync("quick-panel/catalog-updates.mjs", "utf8").replace(
        /^export /gm,
        "",
      ),
    )
    .replace("__SITE_PREVIEW__", () => json(preview))
    .replace(
      "<!--__SITE_PREVIEW_STYLE__-->",
      () =>
        "<style>" +
        readFileSync("quick-panel/site/host.css", "utf8") +
        readFileSync("src/components/model-generations-editor.css", "utf8") +
        "</style>",
    )
    .replace(
      "/*__SITE_PREVIEW_HOST__*/",
      () =>
        Buffer.from(versionLibrary.outputFiles[0].contents).toString() +
        "\n" +
        // The preview provider also scans script-like text inside JS strings.
        Buffer.from(modelLibrary.outputFiles[0].contents)
          .toString()
          .replaceAll("<script>", "\\x3cscript>") +
        "\n" +
        readFileSync("quick-panel/design.mjs", "utf8").replace(
          /^export /gm,
          "",
        ) +
        "\n" +
        readFileSync("quick-panel/site/direct-editor.js", "utf8") +
        "\n" +
        readFileSync("quick-panel/site/host.js", "utf8") +
        "\n" +
        readFileSync("quick-panel/analytics/host.js", "utf8") +
        "\n" +
        readFileSync("quick-panel/studio/host.js", "utf8") +
        "\n" +
        readFileSync("quick-panel/studio/payments.js", "utf8"),
    );
  writeFileSync("docs/panel.html", template);
  const { analyticsJs: _analyticsJs, ...customerPreview } = preview;
  const customerScript = readFileSync("quick-panel/site/customer.js", "utf8")
    .replace("__SEED__", () => json(data))
    .replace("__SITE_PREVIEW__", () => json(customerPreview))
    .replace(
      "/*__DESIGN_VALIDATOR__*/",
      () =>
        Buffer.from(versionLibrary.outputFiles[0].contents).toString() +
        "\n" +
        readFileSync("quick-panel/design.mjs", "utf8").replace(
          /^export /gm,
          "",
        ),
    )
    .replace("/*__CATALOG_UPDATES__*/", () =>
      readFileSync("quick-panel/catalog-updates.mjs", "utf8").replace(
        /^export /gm,
        "",
      ),
    );
  writeFileSync(
    "docs/store.html",
    '<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>KUZMIN · Müşteri önizlemesi</title><style>' +
      styles.css +
      '</style></head><body><div id="root"></div><script>' +
      customerScript +
      "</script></body></html>",
  );
  writeFileSync(
    "docs/panel-version.json",
    JSON.stringify({ version, built_at: builtAt }) + "\n",
  );
  console.log(
    "Self-contained catalog + real storefront preview built: docs/panel.html",
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
