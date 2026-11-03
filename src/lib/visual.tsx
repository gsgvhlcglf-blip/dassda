"use client";
import { createContext, useContext } from "react";
import { translate, type MessageKey } from "./i18n";
import type { Lang } from "./types";
export type VisualDesign = {
  texts: Partial<Record<Lang, Record<string, string>>>;
  images: Record<string, string>;
};
export const VisualContext = createContext<VisualDesign>({
  texts: {},
  images: {},
});
export function useVisualTranslate(lang: Lang) {
  const design = useContext(VisualContext);
  return (key: MessageKey): string =>
    design.texts[lang]?.["ui:" + key] ?? translate(lang, key);
}
export function useVisualImage(
  key: string | undefined,
  fallback: string | undefined,
) {
  const design = useContext(VisualContext);
  return (key && design.images[key]) || fallback;
}

export function useVisualCopy(lang: Lang) {
  const design = useContext(VisualContext);
  return (key: string, fallback: string) =>
    design.texts[lang]?.["slot:" + key] ?? fallback;
}
