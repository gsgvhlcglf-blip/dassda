import { browserPublished } from "../../src/lib/browser-versions";
import { PreviewAnalyticsRecorder } from "./analytics";
import { HeatmapMessageLayer } from "../../src/components/analytics-heatmap";
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Storefront } from "../../src/components/storefront";
import { SiteTextLanguage } from "../../src/components/visual-text";
import { VisualContext } from "../../src/lib/visual";
import { messageEntries } from "../../src/lib/i18n";
import { resolveStoreLanguage } from "../../src/lib/settings";
import {
  selectLogoGuide,
  setLogoGuideEditing,
  handleLogoGuideMessage,
  initializeLogoGuides,
} from "./logo-guides";
import { setNavigator } from "./routing";
import type { Lang } from "../../src/lib/types";
import type {} from "./types";
const config = window.__KZ_SITE__;
let inspect = config.inspect;
document.documentElement.dataset.kuzminEditing = String(inspect);
const regions: [string, string, string][] = [
  [".site-header .header-wordmark", "header.logo", "Üst menü · Logo"],
  [".primary-nav", "header.navigation", "Üst menü · Sayfa bağlantıları"],
  [".nav-actions", "header.actions", "Üst menü · Hesabım ve sepet"],
  [".site-header", "header", "Üst menü"],
  [".hero h1", "home.hero.title", "Ana sayfa · Ana başlık"],
  [
    ".hero-content > p:not(.eyebrow)",
    "home.hero.description",
    "Ana sayfa · Ana açıklama",
  ],
  [".hero .button", "home.hero.button", "Ana sayfa · Alışveriş düğmesi"],
  [".hero", "home.hero", "Ana sayfa · Banner videosu"],
  [".home-brands h2", "home.brands.title", "Ana sayfa · Markanı seç başlığı"],
  [".home-brands .brand-word", "home.brand.logo", "Ana sayfa · Marka logosu"],
  [".home-brands .brand-card", "home.brand", "Ana sayfa · Marka bağlantısı"],
  [".home-bestsellers", "home.bestsellers", "Ana sayfa · En çok satanlar"],
  [".home-brands", "home.brands", "Ana sayfa · Marka seçimi"],
  [
    ".quote-request:not(.home-custom)",
    "request.quote",
    "Motosiklet · Teklif çağrısı",
  ],
  [".home-custom h2", "home.custom.title", "Ana sayfa · Özel üretim başlığı"],
  [
    ".home-custom-action > p",
    "home.custom.intro",
    "Ana sayfa · Teklif çağrısı",
  ],
  [
    ".home-custom .button",
    "home.custom.action",
    "Ana sayfa · Talep oluştur düğmesi",
  ],
  [".home-custom", "home.custom", "Ana sayfa · Parçanı ürettir"],
  [".blog-banner-media", "blog.banner.image", "Blog · Banner görseli"],
  [".blog-card", "blog.banner", "Blog · Konu banneri"],
  [
    ".blog-article-banner",
    "blog.article.banner",
    "Blog yazısı · Kapak banneri",
  ],
  [".editorial-section", "home.collections", "Ana sayfa · Koleksiyon kartları"],
  [".bike-section", "home.brands", "Ana sayfa · Marka kartları"],
  [".featured-section", "home.featured", "Ana sayfa · Öne çıkan ürünler"],
  [".craft-section", "home.story", "Ana sayfa · İşçilik ve hikâye"],
  [".brand-word", "motorcycles.logo", "Marka kartı · Logo"],
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
type Binding = { type: "record" | "text" | "image"; key: string; lang: Lang };
let activeInline: HTMLElement | null = null;
function bindingFor(
  target: Element,
): { binding: Binding; element: Element; value: string } | null {
  const lang = document.documentElement.lang as Lang;
  const image = target.closest("[data-visual-image]");
  const explicitText = target.closest("[data-visual-text],[data-edit-text]");
  if (image && (!explicitText || !image.contains(explicitText)))
    return {
      binding: {
        type: "image",
        key: image.getAttribute("data-visual-image")!,
        lang,
      },
      element: image,
      value:
        (image instanceof HTMLImageElement
          ? image.src
          : image.querySelector("img")?.src) || "",
    };
  const record = explicitText?.hasAttribute("data-edit-text")
    ? explicitText
    : null;
  if (record) {
    const key = record.getAttribute("data-edit-text")!;
    const [table, id, field] = key.split(":");
    const row = (
      config.catalog[table as keyof typeof config.catalog] as unknown as Record<
        string,
        unknown
      >[]
    )?.find((r) => r.id === id);
    const raw = row?.[field];
    const value =
      raw && typeof raw === "object"
        ? (raw as Record<string, string>)[lang]
        : String(raw ?? "");
    return {
      binding: { type: "record", key, lang },
      element: record,
      value: value || "",
    };
  }
  const slot = explicitText?.hasAttribute("data-visual-text")
    ? explicitText
    : null;
  if (slot)
    return {
      binding: {
        type: "text",
        key: slot.getAttribute("data-visual-text")!,
        lang,
      },
      element: slot,
      value: slot.textContent || "",
    };
  const text = target.closest("h1,h2,h3,p,button,a,label,span,legend,b");
  if (!text) return null;
  const value = (text.textContent || "").trim();
  const comparable = value.replace(/^[0-9]{2} \/ /, "").replace(/\.$/, "");
  const match = messageEntries(lang).find(
    ([key, original]) =>
      (config.design?.texts[lang]?.["ui:" + key] ?? original) === value ||
      (config.design?.texts[lang]?.["ui:" + key] ?? original).replace(
        /\.$/,
        "",
      ) === comparable,
  );
  return match
    ? {
        binding: { type: "text", key: "ui:" + match[0], lang },
        element: text,
        value: config.design?.texts[lang]?.["ui:" + match[0]] ?? match[1],
      }
    : null;
}
function stopInline() {
  if (!activeInline) return;
  activeInline.contentEditable = "false";
  activeInline.oninput = null;
  activeInline.onblur = null;
  activeInline.onkeydown = null;
  window.getSelection()?.removeAllRanges();
  activeInline.removeAttribute("data-inline-editing");
  activeInline = null;
}
document.addEventListener(
  "click",
  (event) => {
    if (
      !inspect ||
      !(event.target instanceof Element) ||
      event.target.closest("[data-kz-logo-guides],[data-no-editor]")
    )
      return;
    if (activeInline?.contains(event.target)) return;
    event.preventDefault();
    event.stopPropagation();
    stopInline();
    const match = findRegion(event.target);
    if (!match) return;
    const field = bindingFor(event.target);
    selectLogoGuide(
      field?.binding.type === "image" && field.binding.key.startsWith("brand:")
        ? field.binding.key
        : null,
    );
    highlight(field?.element || event.target);
    const text =
      field?.element ||
      event.target.closest("h1,h2,h3,p,button,a,label,img") ||
      match.element;
    window.parent.postMessage(
      {
        type: "kz-site-selection",
        selection: {
          id: match.id,
          label: match.title,
          selector: match.selector,
          text: field?.value ?? (text.textContent || "").trim().slice(0, 600),
          kind: text.tagName.toLowerCase(),
          href: event.target.closest("a")?.getAttribute("href") || "",
          binding: field?.binding || null,
        },
      },
      "*",
    );
    // Plain text leaf nodes can be edited directly without replacing icons or markup.
    if (
      field &&
      field.binding.type !== "image" &&
      !field.binding.key.endsWith(":price") &&
      field.element instanceof HTMLElement &&
      !field.element.children.length &&
      (field.element.textContent || "").trim() === field.value
    ) {
      const element = field.element;
      activeInline = element;
      element.contentEditable = "plaintext-only";
      element.dataset.inlineEditing = "true";
      element.focus();
      const range = document.createRange();
      range.selectNodeContents(element);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      element.oninput = () =>
        window.parent.postMessage(
          {
            type: "kz-site-edit",
            binding: field.binding,
            value: element.innerText,
            inline: true,
          },
          "*",
        );
      element.onblur = () => {
        stopInline();
        window.parent.postMessage({ type: "kz-site-inline-end" }, "*");
      };
      element.onkeydown = (e) => {
        if (e.key === "Escape" || (e.key === "Enter" && !e.shiftKey)) {
          e.preventDefault();
          element.blur();
        }
      };
    }
  },
  true,
);
window.addEventListener("message", (event) => {
  if (event.source !== window.parent) return;
  handleLogoGuideMessage(event.data || {});
  if (event.data?.type === "kz-bestseller-guides")
    document.documentElement.dataset.bestsellerGuides = String(
      Boolean(event.data.enabled),
    );
  if (event.data?.type === "kz-site-inspect") {
    inspect = Boolean(event.data.enabled);
    document.documentElement.dataset.kuzminEditing = String(inspect);
    setLogoGuideEditing(inspect);
    overlay.style.display = "none";
    if (!inspect) stopInline();
  }
});
function App() {
  const [, refresh] = useState(0);
  const [route, setRoute] = useState(
    () => new URL(config.path, "https://kuzmin.preview"),
  );
  const [language, setLanguage] = useState<Lang>(
    resolveStoreLanguage(config.lang),
  );
  useEffect(() => {
    if (route.hash) {
      const id = route.hash.slice(1);
      requestAnimationFrame(() =>
        document.getElementById(id)?.scrollIntoView(),
      );
    }
  }, [route]);
  function navigate(url: string, push = true) {
    const next = new URL(url, "https://kuzmin.preview");
    if (
      config.standalone &&
      push &&
      location.hash !== "#" + next.pathname + next.search
    )
      history.pushState(
        null,
        "",
        location.pathname + location.search + "#" + next.pathname + next.search,
      );
    const requested = next.searchParams.get("lang");
    setLanguage(resolveStoreLanguage(requested));
    setRoute(next);
    window.scrollTo(0, 0);
    window.parent.postMessage(
      {
        type: "kz-site-route",
        path: next.pathname + next.search,
        lang: resolveStoreLanguage(requested),
      },
      "*",
    );
  }
  useEffect(() => {
    const disposeGuides = initializeLogoGuides();
    setNavigator(navigate);
    const update = (event: MessageEvent) => {
      if (
        event.source !== window.parent ||
        event.data?.type !== "kz-site-config"
      )
        return;
      config.catalog = event.data.catalog;
      config.design = event.data.design;
      refresh((n) => n + 1);
    };
    const storage = async () => {
      if (!config.standalone || !config.storageKey) return;
      try {
        if (config.viewMode === "published") {
          const published = await browserPublished({
            catalog: config.fallbackCatalog || config.catalog,
            design: { texts: {}, images: {} },
          });
          config.catalog = published.catalog;
          config.design = published.design;
          refresh((n) => n + 1);
          return;
        }
        const catalog = JSON.parse(
          localStorage.getItem(config.storageKey) || "null",
        );
        if (catalog) config.catalog = catalog;
        config.design = JSON.parse(
          localStorage.getItem(config.storageKey + ".design") ||
            '{"texts":{},"images":{}}',
        );
        refresh((n) => n + 1);
      } catch {
        /* Keep the last valid view if a storage read fails. */
      }
    };
    const hash = () => {
      if (config.standalone) navigate(location.hash.slice(1) || "/", false);
    };
    window.addEventListener("message", update);
    window.addEventListener("storage", storage);
    window.addEventListener("hashchange", hash);
    window.addEventListener("focus", storage);
    window.parent.postMessage({ type: "kz-site-ready" }, "*");
    return () => {
      disposeGuides();
      window.removeEventListener("message", update);
      window.removeEventListener("storage", storage);
      window.removeEventListener("hashchange", hash);
      window.removeEventListener("focus", storage);
    };
  }, []);
  const segments = route.pathname.split("/").filter(Boolean);
  if (segments[0] === "admin")
    return (
      <main className="standalone">
        <h1>Bu bölüm canlı yönetim paneline aittir.</h1>
        <p>Önizleme araç çubuğundan başka bir sayfa seçin.</p>
      </main>
    );
  const shop = (
    <VisualContext.Provider value={config.design || { texts: {}, images: {} }}>
      <SiteTextLanguage.Provider value={language}>
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
      </SiteTextLanguage.Provider>
    </VisualContext.Provider>
  );
  if (config.heatmap) return <HeatmapMessageLayer>{shop}</HeatmapMessageLayer>;
  return (
    <>
      {shop}
      {config.standalone && (
        <PreviewAnalyticsRecorder
          path={route.pathname}
          revision={config.revision || "preview"}
        />
      )}
    </>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
