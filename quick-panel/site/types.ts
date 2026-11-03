import type { Catalog, CartLine, Lang } from "../../src/lib/types";
export type SiteConfig = {
  catalog: Catalog;
  path: string;
  lang: Lang;
  assets: Record<string, string>;
  inspect: boolean;
  cart: CartLine[];
};
declare global {
  interface Window {
    __KZ_SITE__: SiteConfig;
  }
}
