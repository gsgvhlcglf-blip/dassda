"use client";
import { useEffect, useState } from "react";
import { VisualContext, type VisualDesign } from "@/lib/visual";
import { Storefront } from "./storefront";
import type { Catalog, Lang } from "@/lib/types";
export function VisualStorefront({
  catalog,
  design,
  path,
  lang = "tr",
  live = false,
  preview = false,
  customer = null,
  query,
}: {
  catalog: Catalog;
  design: VisualDesign;
  path: string;
  lang?: Lang;
  live?: boolean;
  preview?: boolean;
  customer?: import("./customer-pages").CustomerView | null;
  query?: string;
}) {
  const [value, setValue] = useState(design);
  useEffect(() => {
    setValue(design);
  }, [design]);
  useEffect(() => {
    if (!preview) return;
    const listener = (event: MessageEvent) => {
      if (
        event.source === parent &&
        event.origin === location.origin &&
        event.data?.type === "kz-photo-preview"
      )
        setValue(event.data.design);
    };
    window.addEventListener("message", listener);
    parent.postMessage({ type: "kz-photo-ready" }, location.origin);
    return () => window.removeEventListener("message", listener);
  }, [preview]);
  return (
    <VisualContext.Provider value={value}>
      <Storefront
        catalog={catalog}
        segments={path.split("/").filter(Boolean)}
        lang={lang}
        live={live}
        preview={preview}
        customer={customer}
        previewQuery={query}
      />
    </VisualContext.Provider>
  );
}
