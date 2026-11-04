import { getRole } from "@/lib/auth";
import { getCatalog } from "@/lib/catalog";
import { analyticsPath } from "@/lib/analytics";
import { notFound } from "next/navigation";
import { Storefront } from "@/components/storefront";
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
      <Storefront
        catalog={await getCatalog()}
        segments={path.split("/").filter(Boolean)}
        lang="tr"
        live={false}
        preview
      />
    </HeatmapMessageLayer>
  );
}
