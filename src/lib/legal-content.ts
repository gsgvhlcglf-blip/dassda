import templates from "../content/legal-pages.json";
import type { Content } from "./types";
export const legalContentVersion = "2026-11-08-legal-pages-v1";
// Turkish is the active language. Legal translations require owner review before activation.
export const legalPages: Content[] = templates.map(
  ({ id, key, title, body }) => ({
    id,
    key,
    title,
    body: { tr: body, en: body, ru: body },
  }),
);
export const legalContentKeys = new Set(legalPages.map((page) => page.key));

export function applyLegalPages(catalog: import("./types").Catalog) {
  const next = structuredClone(catalog);
  for (const page of legalPages) {
    const existing = next.content.find((row) => row.key === page.key);
    if (existing) {
      existing.title = { ...existing.title, tr: page.title.tr };
      existing.body = { ...existing.body, tr: page.body.tr };
    } else next.content.push(structuredClone(page));
  }
  return next;
}
