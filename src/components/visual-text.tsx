"use client";
import { createContext, useContext } from "react";
import { VisualContext } from "@/lib/visual";
import { siteTextDefault } from "@/lib/site-texts";
import type { Lang } from "@/lib/types";

export const SiteTextLanguage = createContext<Lang>("tr");

export function useSiteText() {
  const design = useContext(VisualContext),
    lang = useContext(SiteTextLanguage);
  return (key: string) =>
    design.texts[lang]?.["slot:" + key] ?? siteTextDefault("slot:" + key, lang);
}

export function VisualText({ textKey }: { textKey: string }) {
  const design = useContext(VisualContext),
    lang = useContext(SiteTextLanguage);
  const value = design.texts[lang]?.[textKey] ?? siteTextDefault(textKey, lang);
  return <span data-visual-text={textKey}>{value}</span>;
}
