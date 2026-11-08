import { z } from "zod";
import type { Catalog, Content } from "./types";
export const bestsellersKey = "home-bestsellers";
export const bestsellerFrameSchema = z
  .object({
    scale: z.number().int().min(50).max(200),
    x: z.number().min(0).max(100),
    y: z.number().min(0).max(100),
    role: z.literal("overview"),
  })
  .strict();
export const bestsellersSchema = z
  .object({
    productIds: z
      .array(z.string().regex(/^[a-zA-Z0-9_-]{1,120}$/))
      .max(10)
      .refine(
        (ids) => new Set(ids).size === ids.length,
        "Aynı ürün bir kez seçilebilir.",
      ),
    intervalSeconds: z.number().int().min(3).max(20),
    frames: z
      .record(z.string().regex(/^[a-zA-Z0-9_-]{1,120}$/), bestsellerFrameSchema)
      .default({}),
  })
  .strict();
export type BestsellersConfig = z.infer<typeof bestsellersSchema>;
export const centeredBestsellerFrame = {
  scale: 100,
  x: 50,
  y: 50,
  role: "overview" as const,
};
export function readBestsellers(
  catalog: Pick<Catalog, "content">,
): BestsellersConfig {
  try {
    const row = catalog.content.find((r) => r.key === bestsellersKey);
    const parsed = bestsellersSchema.safeParse(
      JSON.parse(row?.body.tr || "null"),
    );
    if (parsed.success) return parsed.data;
  } catch {}
  return { productIds: [], intervalSeconds: 5, frames: {} };
}
export function bestsellerRecord(
  config: BestsellersConfig,
  existing?: Content,
): Content {
  const parsed = bestsellersSchema.parse(config);
  return {
    id: existing?.id || bestsellersKey,
    key: bestsellersKey,
    title: existing?.title || {
      tr: "Ana sayfa · En çok satanlar",
      en: "Homepage · Bestsellers",
      ru: "Главная · Популярные товары",
    },
    body: {
      ...(existing?.body || { en: "", ru: "" }),
      tr: JSON.stringify(parsed),
    },
  };
}
export function withBestsellers(
  catalog: Catalog,
  config: BestsellersConfig,
): Catalog {
  const next = structuredClone(catalog),
    index = next.content.findIndex((r) => r.key === bestsellersKey),
    record = bestsellerRecord(config, next.content[index]);
  if (index < 0) next.content.push(record);
  else next.content[index] = record;
  return next;
}
