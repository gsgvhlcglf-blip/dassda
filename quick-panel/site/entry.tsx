import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Storefront } from "../../src/components/storefront";
import { setNavigator } from "./routing";
import type { Lang } from "../../src/lib/types";
import type {} from "./types";
const config = window.__KZ_SITE__;
let inspect = config.inspect;
const regions: [string, string, string][] = [
  [".site-header .logo", "header.logo", "Üst menü · Logo"],
  [".primary-nav", "header.navigation", "Üst menü · Sayfa bağlantıları"],
  [".nav-actions", "header.actions", "Üst menü · Dil ve sepet"],
  [".site-header", "header", "Üst menü"],
  [".hero h1", "home.hero.title", "Ana sayfa · Ana başlık"],
  [
    ".hero-content > p:not(.eyebrow)",
    "home.hero.description",
    "Ana sayfa · Ana açıklama",
  ],
  [".hero .button", "home.hero.button", "Ana sayfa · Alışveriş düğmesi"],
  [".hero", "home.hero", "Ana sayfa · Üst görsel (hero)"],
  [".editorial-section", "home.collections", "Ana sayfa · Koleksiyon kartları"],
  [".bike-section", "home.brands", "Ana sayfa · Marka kartları"],
  [".featured-section", "home.featured", "Ana sayfa · Öne çıkan ürünler"],
  [".craft-section", "home.story", "Ana sayfa · İşçilik ve hikâye"],
  [".brand-page", "motorcycles.brands", "Motosiklet · Marka seçimi"],
  [".model-card", "motorcycles.model-card", "Motosiklet · Model kartı"],
  [".model-grid", "motorcycles.models", "Motosiklet · Model listesi"],
  [".years", "motorcycles.years", "Motosiklet · Üretim yılı seçimi"],
  [".year-layout", "motorcycles.year-layout", "Motosiklet · Yıl sayfası"],
  [".selection-strip", "catalog.selection", "Koleksiyon · Seçili motosiklet"],
  [".catalog-tools", "catalog.filters", "Koleksiyon · Arama ve filtreler"],
  [".product-card", "catalog.product-card", "Koleksiyon · Ürün kartı"],
  [".product-grid", "catalog.products", "Koleksiyon · Ürün listesi"],
  [".detail-main-image", "product.gallery", "Ürün detayı · Ana görsel"],
  [".thumbnails", "product.thumbnails", "Ürün detayı · Görsel galerisi"],
  [".product-copy h1", "product.title", "Ürün detayı · Ürün adı"],
  [".detail-price", "product.price", "Ürün detayı · Fiyat ve stok"],
  [
    ".product-copy .description",
    "product.description",
    "Ürün detayı · Açıklama",
  ],
  [".variant-field", "product.variants", "Ürün detayı · Yüzey seçenekleri"],
  [".add-row", "product.add-to-cart", "Ürün detayı · Adet ve sepete ekleme"],
  [".detail-tabs", "product.tabs", "Ürün detayı · Bilgi sekmeleri"],
  [
    ".tab-content",
    "product.details",
    "Ürün detayı · Teknik detay ve uyumluluk",
  ],
  [".product-copy", "product.information", "Ürün detayı · Ürün bilgileri"],
  [".checkout-form", "checkout.form", "Sipariş talebi · İletişim formu"],
  [".cart-line", "cart.item", "Sepet · Ürün satırı"],
  [".order-summary", "cart.summary", "Sepet / Sipariş · Toplam özeti"],
  [".empty-state", "page.empty", "Sayfa · Boş durum"],
  [".prose-page h1", "content.title", "İçerik sayfası · Başlık"],
  [".content-body", "content.body", "İçerik sayfası · Metin"],
  [".footer-title", "footer.contact", "Alt bilgi · İletişim başlığı"],
  [".footer-nav", "footer.navigation", "Alt bilgi · Bağlantılar"],
  [".footer-bottom", "footer.legal", "Alt bilgi · Yasal açıklama"],
  ["footer", "footer", "Alt bilgi"],
  [".page-section", "page.content", "Sayfa · İçerik alanı"],
];
const overlay = document.createElement("div");
overlay.style.cssText =
  "position:fixed;z-index:999999;pointer-events:none;border:2px solid #cb4e3e;background:#cb4e3e0c;display:none;box-sizing:border-box;";
const label = document.createElement("span");
label.style.cssText =
  "position:absolute;left:-2px;top:0;transform:translateY(-100%);max-width:480px;white-space:nowrap;background:#cb4e3e;color:#fff;font:11px/1.5 Arial;padding:4px 8px;";
overlay.appendChild(label);
document.body.appendChild(overlay);
function findRegion(target: Element) {
  for (const [selector, id, title] of regions) {
    const element = target.closest(selector);
    if (element) return { element, selector, id, title };
  }
  const element = target.closest("h1,h2,h3,p,button,a,label,img,section");
  return element
    ? {
        element,
        selector: element.tagName.toLowerCase(),
        id: "page.element",
        title: "Sayfa · " + element.tagName.toLowerCase(),
      }
    : null;
}
function highlight(target: Element) {
  const match = findRegion(target);
  if (!match) {
    overlay.style.display = "none";
    return;
  }
  const rect = match.element.getBoundingClientRect();
  overlay.style.display = "block";
  overlay.style.left = rect.left + "px";
  overlay.style.top = rect.top + "px";
  overlay.style.width = rect.width + "px";
  overlay.style.height = rect.height + "px";
  label.textContent = match.title;
  label.style.transform = rect.top < 30 ? "none" : "translateY(-100%)";
}
document.addEventListener("pointermove", (event) => {
  if (inspect && event.target instanceof Element) highlight(event.target);
});
document.addEventListener(
  "pointerleave",
  () => (overlay.style.display = "none"),
);
window.addEventListener("scroll", () => (overlay.style.display = "none"));
window.addEventListener("resize", () => (overlay.style.display = "none"));
document.addEventListener(
  "click",
  (event) => {
    if (!(event.target instanceof Element)) return;
    const anchor = event.target.closest("a");
    if (!inspect) {
      if (anchor && /^https?:/i.test(anchor.getAttribute("href") || "")) {
        event.preventDefault();
        event.stopPropagation();
        window.parent.postMessage(
          {
            type: "kz-site-info",
            message: "Harici bağlantı tasarım önizlemesinde açılmaz.",
          },
          "*",
        );
      }
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const match = findRegion(event.target);
    if (!match) return;
    highlight(event.target);
    const text =
      event.target.closest("h1,h2,h3,p,button,a,label,img") || match.element;
    window.parent.postMessage(
      {
        type: "kz-site-selection",
        selection: {
          id: match.id,
          label: match.title,
          selector: match.selector,
          text: (text instanceof HTMLImageElement
            ? text.alt
            : text.textContent || ""
          )
            .trim()
            .slice(0, 600),
          kind: text.tagName.toLowerCase(),
          href: event.target.closest("a")?.getAttribute("href") || "",
        },
      },
      "*",
    );
  },
  true,
);
window.addEventListener("message", (event) => {
  if (event.source !== window.parent) return;
  if (event.data?.type === "kz-site-inspect") {
    inspect = Boolean(event.data.enabled);
    overlay.style.display = "none";
  }
});
function App() {
  const [route, setRoute] = useState(
    () => new URL(config.path, "https://kuzmin.preview"),
  );
  const [language, setLanguage] = useState<Lang>(config.lang);
  function navigate(url: string) {
    const next = new URL(url, "https://kuzmin.preview");
    const requested = next.searchParams.get("lang");
    setLanguage(requested === "en" || requested === "ru" ? requested : "tr");
    setRoute(next);
    window.scrollTo(0, 0);
    window.parent.postMessage(
      {
        type: "kz-site-route",
        path: next.pathname + next.search,
        lang: requested === "en" || requested === "ru" ? requested : "tr",
      },
      "*",
    );
  }
  useEffect(() => {
    setNavigator(navigate);
    window.parent.postMessage({ type: "kz-site-ready" }, "*");
  }, []);
  const segments = route.pathname.split("/").filter(Boolean);
  if (segments[0] === "admin")
    return (
      <main className="standalone">
        <h1>Bu bölüm canlı yönetim paneline aittir.</h1>
        <p>Önizleme araç çubuğundan başka bir sayfa seçin.</p>
      </main>
    );
  return (
    <Storefront
      key={route.pathname + route.search}
      catalog={config.catalog}
      segments={segments}
      lang={language}
      live={false}
      preview
      previewQuery={route.search}
      onNavigate={navigate}
    />
  );
}
createRoot(document.getElementById("root")!).render(<App />);
