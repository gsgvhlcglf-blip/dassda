import type { MetadataRoute } from "next";
import { supportedLanguages } from "@/lib/settings";
import { getCatalog } from "@/lib/catalog";
export const dynamic = "force-dynamic";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = process.env.NEXT_PUBLIC_SITE_URL;
  if (!origin) return [];
  const c = await getCatalog();
  const routes = [
    "",
    "/motosikletler",
    "/urunler",
    "/hakkimizda",
    "/iletisim",
    "/blog",
    "/kargo-takip",
    ...c.content
      .filter((row) => row.key.startsWith("blog-"))
      .map((row) => "/blog/" + row.key.slice(5)),
    "/sss",
    "/teslimat-iade",
    "/gizlilik",
    "/kosullar",
    ...c.brands.map((b) => `/motosikletler/${b.slug}`),
    ...c.models.flatMap((m) => {
      const b = c.brands.find((b) => b.id === m.brand_id);
      return [
        `/motosikletler/${b?.slug}/${m.slug}`,
        ...c.model_years
          .filter((y) => y.model_id === m.id)
          .map((y) => `/motosikletler/${b?.slug}/${m.slug}/${y.year}`),
      ];
    }),
    ...c.products
      .filter((p) => p.published && !p.demo)
      .map((p) => `/urunler/${p.slug}`),
  ];
  return routes.flatMap((route) =>
    supportedLanguages.map((lang) => ({
      url: `${origin.replace(/\/$/, "")}${route}${lang === "tr" ? "" : "?lang=" + lang}`,
      alternates: {
        languages: Object.fromEntries(
          supportedLanguages.map((language) => [
            language,
            `${origin.replace(/\/$/, "")}${route}${language === "tr" ? "" : "?lang=" + language}`,
          ]),
        ),
      },
    })),
  );
}
