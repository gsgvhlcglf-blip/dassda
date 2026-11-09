import { analyticsPath } from "./analytics";

// Design previews include forms and account screens that must stay out of analytics.
const previewOnly = new Set([
  "/parcani-urettir",
  "/sepet",
  "/odeme",
  "/giris",
  "/uye-ol",
  "/hesabim",
  "/iptal-iade-kosullari",
  "/mesafeli-satis-sozlesmesi",
  "/on-bilgilendirme-formu",
]);
export function storefrontPreviewPath(value: string) {
  try {
    const path = new URL(value, "https://preview.invalid").pathname;
    return analyticsPath(path) ?? (previewOnly.has(path) ? path : null);
  } catch {
    return null;
  }
}
