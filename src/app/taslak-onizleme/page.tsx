import { getRole } from "@/lib/auth";
import { getWorkspace } from "@/lib/site-version-store";
import { storefrontPreviewPath } from "@/lib/storefront-preview";
import { notFound } from "next/navigation";
import { VisualStorefront } from "@/components/visual-storefront";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Taslak önizlemesi",
  robots: { index: false, follow: false },
};
export default async function DraftPreview({
  searchParams,
}: {
  searchParams: Promise<{ path?: string }>;
}) {
  if (!(await getRole())) notFound();
  const path = storefrontPreviewPath((await searchParams).path || "/");
  if (!path) notFound();
  const workspace = await getWorkspace();
  return (
    <>
      <div className="draft-preview-notice">
        TASLAK ÖNİZLEMESİ · Canlı mağazaya aktarılmadı.
      </div>
      <VisualStorefront
        catalog={workspace.snapshot.catalog}
        design={workspace.snapshot.design}
        path={path}
        preview
      />
    </>
  );
}
