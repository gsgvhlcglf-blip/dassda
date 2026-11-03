<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Browser design review workflow

The user reviews the final storefront visually through the install-free workspace (`docs/panel.html` via HTMLPreview). Keep the visual-first screen and the stable `main/docs/panel.html` entry working. Preserve the catalog storage key `kuzmin.workspace.gsgvhlcglf-blip.dassda.v1` and existing owner drafts.

Make storefront design changes in `src/components/storefront.tsx` and `src/app/globals.css`; the preview bundles those exact components. Run `npm run panel:build` after design changes. Commit the generated `docs/panel.html` **and** `docs/store.html` / `docs/panel-version.json` together with the sources in the established repository publication workflow. An open preview checks the version periodically and on focus. It reloads after publication, keeps page/device preferences, and defers while an edit dialog or inline editor is open. Direct editing also persists a `.design` storage record; preserve it with the catalog. The customer view opens separately and shares drafts only within the same browser/profile and origin. Do not claim that cloud-local edits are visible before rebuilding and publishing.

For explicitly requested catalog copy changes, add an immutable, unique update entry in `quick-panel/content-updates.json` (`id`, `table`, `recordId`, `changes`) in addition to updating the default seed when appropriate. Only patch the requested public catalog fields. Applied update IDs are tracked so later owner edits and unrelated data are retained. Never reset the entire browser catalog to change one text. This draft workspace must not receive customer orders or secret values.

Relevant checks: `npm run typecheck`, `node scripts/test-site-preview.mjs`, `node scripts/test-preview-updates.mjs` (provider transport simulation), `node scripts/test-direct-editor.mjs` (including `TEST_PROVIDER=1`), and the existing catalog workspace tests. The local static test server is `python3 -m http.server 4173 --bind 127.0.0.1`. Run the application's build and functional checks when shared storefront behavior changes. Prefer targeted visual verification for small CSS/text iterations; do not repeat unrelated suites unnecessarily.
