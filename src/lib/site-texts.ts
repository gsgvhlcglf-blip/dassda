import { messageEntries, translate } from "./i18n";
import { siteTextDefaults } from "./site-text-defaults";
import type { Lang } from "./types";
import type { VisualDesign } from "./visual";
const uiDefaults = Object.fromEntries(
  (["tr", "en", "ru"] as const).map((lang) => [
    lang,
    Object.fromEntries(
      messageEntries(lang).map(([key, value]) => ["ui:" + key, value]),
    ),
  ]),
);

export function siteTextEntries(lang: Lang, design?: VisualDesign) {
  const defaults: Record<string, string> = {
    ...Object.fromEntries(
      messageEntries(lang).map(([key, text]) => ["ui:" + key, text]),
    ),
    ...Object.fromEntries(
      Object.entries(siteTextDefaults).map(([key, text]) => [
        "slot:" + key,
        text,
      ]),
    ),
    "slot:header.brand": "KUZMIN",
    "slot:header.tagline": "CARBON MOTORCYCLE PARTS",
    "slot:home.brands.title": translate(lang, "homeChooseBrand"),
    "slot:home.bestsellers.title": "En çok satanlar.",
    "slot:home.custom.title": translate(lang, "homeCustomTitle"),
    "slot:home.custom.intro": translate(lang, "homeCustomIntro"),
    "slot:home.custom.action": translate(lang, "homeCustomAction"),
    "slot:footer.legal.notice": `© ${new Date().getFullYear()} KUZMIN. ${translate(lang, "independent")}`,
    "slot:requests.material.twill.title": "Twill Carbon",
    "slot:photo.caption.overview": "Genel görünüm",
    "slot:photo.caption.texture": "Doku detayı",
    "slot:photo.caption.finish": "Yüzey detayı",
  };
  const groups: Record<string, string> = {
    store: "Mağaza",
    request: "Parçanı ürettir",
    customer: "Hesap ve blog",
    cookie: "Çerez bildirimi",
    payment: "Ödeme",
    quote: "Teklif alanı",
    video: "Banner",
    home: "Ana sayfa",
    header: "Üst menü",
    footer: "Alt bilgi",
    requests: "Parçanı ürettir",
  };
  return [
    ...new Set([
      ...Object.keys(defaults),
      ...Object.keys(design?.texts[lang] || {}),
    ]),
  ].map((key) => {
    const scope = key.replace(/^slot:(copy\.)?/, "").split(".")[0];
    const fallback = defaults[key] ?? "";
    return {
      key,
      fallback,
      group: key.startsWith("ui:")
        ? "Arayüz"
        : groups[scope] || "Diğer metinler",
      label:
        key === "slot:request.custom.note"
          ? "Talep formu · Alt açıklama"
          : fallback || key,
      value: design?.texts[lang]?.[key] ?? fallback,
    };
  });
}

export function siteTextDefault(key: string, lang: Lang) {
  if (key.startsWith("slot:")) return siteTextDefaults[key.slice(5)] ?? "";
  return uiDefaults[lang]?.[key] ?? "";
}
