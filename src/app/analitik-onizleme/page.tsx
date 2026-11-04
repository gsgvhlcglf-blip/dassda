import { getRole } from "@/lib/auth";
import { getCatalog } from "@/lib/catalog";
import { analyticsPath } from "@/lib/analytics";
import { notFound } from "next/navigation";
import { VisualStorefront } from "@/components/visual-storefront";
import { publishedDesign } from "@/lib/site-version-store";
import { HeatmapMessageLayer } from "@/components/analytics-heatmap";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Analitik önizlemesi",
  robots: { index: false, follow: false },
};
export default async function AnalyticsPreview({
  searchParams,
}: {
  searchParams: Promise<{ path?: string }>;
}) {
  if ((await getRole()) !== "admin") notFound();
  const path = analyticsPath((await searchParams).path || "/");
  if (!path) notFound();
  return (
    <HeatmapMessageLayer>
      <VisualStorefront
        catalog={await getCatalog()}
        design={await publishedDesign()}
        path={path}
        lang="tr"
        live={false}
        preview
      />
    </HeatmapMessageLayer>
  );
}
