import type { Catalog, CartLine, Lang } from "../../src/lib/types";
export type SiteConfig = {
  catalog: Catalog;
  path: string;
  lang: Lang;
  assets: Record<string, string>;
  inspect: boolean;
  logoGuides?: boolean;
  cart: CartLine[];
  design?: import("../../src/lib/visual").VisualDesign;
  standalone?: boolean;
  storageKey?: string;
  viewMode?: "draft"|"published";
  fallbackCatalog?: Catalog;
  heatmap?: boolean;
  revision?: string;
};
declare global {
  interface Window {
    __KZ_SITE__: SiteConfig;
  }
}
