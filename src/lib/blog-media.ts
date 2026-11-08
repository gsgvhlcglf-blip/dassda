const images: Record<
  string,
  { cover: string; a: string; b?: string; captions: string[] }
> = {
  "blog-karbon-fiber-nedir": {
    cover: "/images/home-editorial-weave.webp",
    a: "/images/carbon-twill.svg",
    captions: [
      "Örgülü karbon liflerinin şematik görünümü. Doku, bütün katmanların teknik yapısını tek başına açıklamaz.",
    ],
  },
  "blog-infuzyon-laminasyon-nedir": {
    cover: "/images/process-infusion.svg",
    a: "/images/process-lamination.svg",
    b: "/images/process-infusion.svg",
    captions: [
      "Mevcut parça üzerine karbon uygulaması — şematik anlatım.",
      "Kalıpta vakum infüzyon yaklaşımı — şematik anlatım.",
    ],
  },
  "blog-twill-forged-karbon-farki": {
    cover: "/images/home-editorial-detail.webp",
    a: "/images/carbon-twill.svg",
    b: "/images/carbon-forged.svg",
    captions: [
      "Twill: düzenli, diyagonal örgü görünümü.",
      "Forged: kesilmiş liflerle oluşan düzensiz desenin şematik görünümü.",
    ],
  },
};
export function defaultBlogImage(
  key: string,
  variant: "cover" | "a" | "b" = "cover",
) {
  return images[key]?.[variant];
}
export function blogFigureCaptions(key: string) {
  return images[key]?.captions || [];
}
export function blogDescription(body: string) {
  return (
    body
      .split("\n")
      .find((line) => line.trim() && !line.startsWith("#"))
      ?.slice(0, 158) ||
    "Karbon kompozitler, malzeme ve üretim yöntemleri üzerine KUZMIN rehberi."
  );
}
