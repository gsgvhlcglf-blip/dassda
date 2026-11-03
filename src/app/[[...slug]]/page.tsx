import { getCatalog } from "@/lib/catalog";
import { isLive } from "@/lib/database";
import { Storefront } from "@/components/storefront";
import { Admin } from "@/components/admin";
import { getRole } from "@/lib/auth";
import { getCustomer } from "@/lib/customer";
import { notFound, redirect } from "next/navigation";
import type { Lang } from "@/lib/types";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
type Props = {
  params: Promise<{ slug?: string[] }>;
  searchParams: Promise<{ lang?: string; next?: string }>;
};
export async function generateMetadata({ params, searchParams }: Props) {
  const { slug = [] } = await params,
    requested = (await searchParams).lang;
  const lang: Lang =
    requested === "en" || requested === "ru" ? requested : "tr";
  const base = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  const route = "/" + slug.join("/");
  const canonical = base
    ? `${base}${route}${lang === "tr" ? "" : "?lang=" + lang}`
    : undefined;
  const common = {
    alternates: canonical
      ? {
          canonical,
          languages: {
            tr: `${base}${route}`,
            en: `${base}${route}?lang=en`,
            ru: `${base}${route}?lang=ru`,
          },
        }
      : undefined,
  };
  if (slug[0] === "urunler" && slug[1]) {
    const c = await getCatalog(),
      p = c.products.find((p) => p.slug === slug[1]);
    if (p)
      return {
        ...common,
        title: p.title[lang] || p.title.tr,
        description: p.description[lang] || p.description.tr,
        openGraph: {
          title: p.title[lang] || p.title.tr,
          description: p.description[lang] || p.description.tr,
          type: "website" as const,
        },
        robots: p.demo ? { index: false, follow: false } : undefined,
      };
  }
  return {
    ...common,
    title:
      slug[0] === "motosikletler"
        ? {
            tr: "Motosikletini seç",
            en: "Find your motorcycle",
            ru: "Выберите мотоцикл",
          }[lang]
        : slug[0] === "admin"
          ? "Yönetim"
          : "KUZMIN — Karbon. Karakter.",
    robots: ["admin", "sepet", "odeme", "giris", "uye-ol", "hesabim"].includes(
      slug[0],
    )
      ? { index: false, follow: false }
      : undefined,
  };
}
export default async function Page({ params, searchParams }: Props) {
  const { slug = [] } = await params;
  const langParam = (await searchParams).lang;
  const lang: Lang =
    langParam === "en" || langParam === "ru" ? langParam : "tr";
  if (slug[0] === "admin") {
    if (slug.length > 2 || (slug[1] && slug[1] !== "ayarlar")) notFound();
    const role = await getRole();
    return (
      <Admin
        role={role}
        live={isLive}
        initialSection={slug[1] === "ayarlar" ? "settings" : "overview"}
        configuration={
          role
            ? {
                supabaseUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
                supabaseKey: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
                siteUrl: Boolean(process.env.NEXT_PUBLIC_SITE_URL),
                indexing:
                  process.env.ENABLE_INDEXING === "true" &&
                  Boolean(process.env.NEXT_PUBLIC_SITE_URL),
              }
            : undefined
        }
      />
    );
  }
  const valid = [
    "motosikletler",
    "urunler",
    "sepet",
    "odeme",
    "hakkimizda",
    "iletisim",
    "sss",
    "teslimat-iade",
    "gizlilik",
    "kosullar",
    "blog",
    "kargo-takip",
    "giris",
    "uye-ol",
    "hesabim",
  ];
  if (slug.length && !valid.includes(slug[0])) notFound();
  const customer = await getCustomer();
  if (["odeme", "hesabim"].includes(slug[0]) && !customer)
    redirect(
      "/giris?next=" +
        encodeURIComponent(
          "/" + slug[0] + (lang === "tr" ? "" : "?lang=" + lang),
        ) +
        (lang === "tr" ? "" : "&lang=" + lang),
    );
  const catalog = await getCatalog();
  if (
    slug[0] === "blog" &&
    slug[1] &&
    !catalog.content.some((row) => row.key === "blog-" + slug[1])
  )
    notFound();
  if (
    slug[0] === "urunler" &&
    slug[1] &&
    !catalog.products.some((p) => p.slug === slug[1] && p.published)
  )
    notFound();
  if (slug[0] === "motosikletler" && slug[1]) {
    const brand = catalog.brands.find((b) => b.slug === slug[1]);
    if (!brand) notFound();
    if (slug[2]) {
      const m = catalog.models.find(
        (m) => m.slug === slug[2] && m.brand_id === brand.id,
      );
      if (!m) notFound();
      if (
        slug[3] &&
        !catalog.model_years.some(
          (y) => y.model_id === m.id && y.year === Number(slug[3]),
        )
      )
        notFound();
    }
  }
  if (
    slug.length >
    (slug[0] === "motosikletler"
      ? 4
      : ["urunler", "blog"].includes(slug[0])
        ? 2
        : 1)
  )
    notFound();
  return (
    <Storefront
      catalog={catalog}
      segments={slug}
      lang={lang}
      live={isLive}
      customer={customer}
      previewQuery={"?" + new URLSearchParams(await searchParams).toString()}
    />
  );
}
