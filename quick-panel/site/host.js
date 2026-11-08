const sitePages = {
  home: ["Ana sayfa", "/"],
  custom: ["Parçanı ürettir", "/parcani-urettir"],
  brands: ["Marka seçimi", "/motosikletler"],
  models: ["Model seçimi", ""],
  years: ["Yıl seçimi", ""],
  fitment: ["Uyumlu ürünler", ""],
  catalog: ["Tüm ürünler", "/urunler"],
  product: ["Ürün detayı", ""],
  cart: ["Sepet", "/sepet"],
  checkout: ["Sipariş talebi", "/odeme"],
  about: ["Hakkımızda", "/hakkimizda"],
  blog: ["Blog", "/blog"],
  tracking: ["Kargo takip", "/kargo-takip"],
  login: ["Üye girişi", "/giris"],
  signup: ["Üye ol", "/uye-ol"],
  account: ["Hesabım", "/hesabim"],
  contact: ["İletişim", "/iletisim"],
  faq: ["Sık sorulan sorular", "/sss"],
  shipping: ["İptal ve İade Koşulları", "/iptal-iade-kosullari"],
  distanceSales: ["Mesafeli Satış Sözleşmesi", "/mesafeli-satis-sozlesmesi"],
  preInformation: ["Ön Bilgilendirme Formu", "/on-bilgilendirme-formu"],
  privacy: ["Gizlilik ve Çerez Politikası", "/gizlilik"],
  terms: ["Kullanıcı Sözleşmesi / Şartlar ve Koşullar", "/kosullar"],
};
let sitePendingVersion = "",
  siteUpdateBusy = false;
let sitePage = "home",
  siteDevice = window.innerWidth < 700 ? "mobile" : "desktop",
  siteBrand = "yamaha",
  siteModel = "yamaha-mt-25",
  siteYear = 2024,
  siteProduct = state.products[0]?.id || "",
  siteLang = "tr",
  siteInspect = true,
  siteLogoGuides = true,
  siteCart = [],
  siteCartMode = "sample",
  siteSelection = null,
  siteNote = "",
  sitePath = "/",
  siteExpanded = true,
  siteObserver,
  siteScriptURL;
try {
  const saved = JSON.parse(localStorage.getItem(KEY + ".preview-ui") || "null");
  if (saved) {
    if (sitePages[saved.page]) sitePage = saved.page;
    if (["desktop", "tablet", "mobile"].includes(saved.device))
      siteDevice = saved.device;
    if (PREVIEW.languages.includes(saved.lang)) siteLang = saved.lang;
    if (typeof saved.brand === "string") siteBrand = saved.brand;
    if (typeof saved.model === "string") siteModel = saved.model;
    if (Number.isInteger(saved.year)) siteYear = saved.year;
    if (typeof saved.product === "string") siteProduct = saved.product;
    if (saved.editorVersion === 2 && typeof saved.inspect === "boolean")
      siteInspect = saved.inspect;
    if (typeof saved.logoGuides === "boolean")
      siteLogoGuides = saved.logoGuides;
    if (typeof saved.note === "string") siteNote = saved.note.slice(0, 8000);
    if (saved.selection && typeof saved.selection.id === "string")
      siteSelection = {
        id: saved.selection.id.slice(0, 120),
        label: String(saved.selection.label || "Bölüm").slice(0, 160),
        text: String(saved.selection.text || "").slice(0, 600),
        selector: String(saved.selection.selector || ""),
        href: String(saved.selection.href || ""),
      };
  }
} catch {}
function saveSiteUi() {
  try {
    localStorage.setItem(
      KEY + ".preview-ui",
      JSON.stringify({
        page: sitePage,
        device: siteDevice,
        lang: siteLang,
        brand: siteBrand,
        model: siteModel,
        year: siteYear,
        product: siteProduct,
        inspect: siteInspect,
        logoGuides: siteLogoGuides,
        editorVersion: 2,
        selection: siteSelection,
        note: siteNote,
      }),
    );
  } catch {}
}
const siteWidths = { desktop: 1280, tablet: 768, mobile: 390 },
  siteDeviceNames = { desktop: "Masaüstü", tablet: "Tablet", mobile: "Mobil" };
function decodePreview(value) {
  return new TextDecoder().decode(
    Uint8Array.from(atob(value), (c) => c.charCodeAt(0)),
  );
}
function normalizeSiteSelection() {
  if (!state.brands.some((b) => b.id === siteBrand))
    siteBrand = state.brands[0]?.id;
  const models = state.models.filter((m) => m.brand_id === siteBrand);
  if (!models.some((m) => m.id === siteModel)) siteModel = models[0]?.id || "";
  const years = state.model_years
    .filter((y) => y.model_id === siteModel)
    .sort((a, b) => b.year - a.year);
  if (!years.some((y) => y.year === siteYear)) siteYear = years[0]?.year || 0;
  if (!state.products.some((p) => p.id === siteProduct))
    siteProduct = state.products[0]?.id || "";
}
function pathForSitePage() {
  normalizeSiteSelection();
  const brand = state.brands.find((b) => b.id === siteBrand),
    model = state.models.find((m) => m.id === siteModel),
    product = state.products.find((p) => p.id === siteProduct);
  const base = "/motosikletler/" + (brand?.slug || "yamaha");
  return sitePage === "models"
    ? base
    : sitePage === "years"
      ? model
        ? base + "/" + model.slug
        : base
      : sitePage === "fitment"
        ? model
          ? base + "/" + model.slug + (siteYear ? "/" + siteYear : "")
          : base
        : sitePage === "product"
          ? product
            ? "/urunler/" + product.slug
            : "/urunler"
          : sitePages[sitePage][1];
}
function siteOption(id, label, value) {
  return `<option value="${esc(id)}" ${String(id) === String(value) ? "selected" : ""}>${esc(label)}</option>`;
}
function siteFilters() {
  const bike = ["models", "years", "fitment"].includes(sitePage),
    product = sitePage === "product",
    cart = ["cart", "checkout"].includes(sitePage);
  return `${bike ? `<label class="site-filter">Marka<select id="site-brand" aria-label="Marka">${state.brands.map((b) => siteOption(b.id, b.name, siteBrand)).join("")}</select></label>` : ""}${
    bike && sitePage !== "models"
      ? `<label class="site-filter">Model<select id="site-model" aria-label="Model">${state.models
          .filter((m) => m.brand_id === siteBrand)
          .map((m) => siteOption(m.id, m.name, siteModel))
          .join("")}</select></label>`
      : ""
  }${
    sitePage === "fitment"
      ? `<label class="site-filter">Yıl<select id="site-year" aria-label="Yıl">${state.model_years
          .filter((y) => y.model_id === siteModel)
          .sort((a, b) => b.year - a.year)
          .map((y) => siteOption(y.year, y.year, siteYear))
          .join("")}</select></label>`
      : ""
  }${
    product
      ? `<label class="site-filter">Ürün<select id="site-product" aria-label="Ürün">${state.products
          .map((p) =>
            siteOption(
              p.id,
              (p.title[siteLang] || p.title.tr) +
                (p.published ? "" : " (Taslak)"),
              siteProduct,
            ),
          )
          .join("")}</select></label>`
      : ""
  }${cart ? `<label class="site-filter">Sepet durumu<select id="site-cart-mode" aria-label="Sepet durumu">${siteOption("sample", "Örnek ürünlü", siteCartMode)}${siteOption("empty", "Boş sepet", siteCartMode)}</select></label>` : ""}`;
}
function renderSitePreview(view) {
  normalizeSiteSelection();
  saveSiteUi();
  sitePath = pathForSitePage();
  view.innerHTML = `<section class="site-preview-shell ${siteExpanded ? "site-preview-expanded" : ""}" id="site-preview-shell"><div class="site-controls"><label>Önizlenecek sayfa<select id="site-page" aria-label="Önizlenecek sayfa">${Object.entries(
    sitePages,
  )
    .map(([id, v]) => siteOption(id, v[0], sitePage))
    .join(
      "",
    )}</select></label>${siteFilters()}<div class="site-device-group" aria-label="Ekran boyutu">${Object.entries(
    siteDeviceNames,
  )
    .map(
      ([id, label]) =>
        `<button data-action="site-device" data-id="${id}" aria-pressed="${siteDevice === id}">${label}</button>`,
    )
    .join(
      "",
    )}</div></div><p class="site-preview-hint ${siteInspect ? "" : "hidden"}">Sayfa seçin, masaüstü/mobil görünümü değiştirin. Düzenleme modunda metne tıklayıp yazın veya sağdaki alandan değiştirin. Fotoğrafa tıklayıp yenisini yükleyin.</p><div class="site-preview-grid ${siteInspect ? "has-inspector" : ""}"><div class="site-frame-box"><div class="site-frame-toolbar"><label><input type="checkbox" id="site-inspect" ${siteInspect ? "checked" : ""}>Düzenleme modu</label><span class="site-route" id="site-route">${esc(sitePath)} · ${siteWidths[siteDevice]} px</span><span id="site-loading">Yükleniyor…</span><span id="site-update-status" title="Tasarım sürümü ${PREVIEW.version}">Otomatik güncelleme açık</span><button data-action="site-customer">Müşteri önizlemesi ↗</button><button data-action="site-published">Yayımlananı gör ↗</button><button data-action="site-release">Yayın & sürümler</button><button data-action="site-expand">${siteExpanded ? "Paneli göster" : "Genişlet"}</button><button data-action="site-dashboard">Veri paneli</button><button data-action="site-refresh">Güncel tasarımı yükle</button></div><div class="site-viewport" id="site-viewport"><div class="site-scale" id="site-scale"><iframe class="site-frame" id="site-frame" title="Mağaza sayfası tasarım önizlemesi" sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"></iframe></div></div><div class="site-small-note">Tasarım önizlemesi · Tarayıcıdaki taslak veriler gösterilir; canlı mağaza güncellenmez. Sipariş gönderimi kapalıdır.</div></div><aside class="site-inspector ${siteInspect ? "" : "hidden"}" id="site-inspector"></aside></div></section>`;
  paintSiteInspector();
  loadSiteFrame();
  siteObserver?.disconnect();
  siteObserver = new ResizeObserver(sizeSiteFrame);
  siteObserver.observe($("#site-viewport"));
  sizeSiteFrame();
}
function sampleSiteCart() {
  const p = state.products.find(
    (p) =>
      p.published &&
      p.stock > 0 &&
      state.variants.some((v) => v.product_id === p.id && v.stock > 0),
  );
  const v = state.variants.find((v) => v.product_id === p?.id && v.stock > 0);
  return p && v ? [{ productId: p.id, variantId: v.id, quantity: 1 }] : [];
}
function loadSiteFrame() {
  const frame = $("#site-frame");
  if (!frame) return;
  if (["cart", "checkout"].includes(sitePage)) {
    if (siteCartMode === "empty") siteCart = [];
    else if (!siteCart.length) siteCart = sampleSiteCart();
  }
  if (!siteScriptURL)
    siteScriptURL = URL.createObjectURL(
      new Blob([decodePreview(PREVIEW.js)], { type: "text/javascript" }),
    );
  const config = {
    catalog: state,
    design: siteDesign,
    path:
      sitePath +
      (siteLang === "tr"
        ? ""
        : (sitePath.includes("?") ? "&" : "?") + "lang=" + siteLang),
    lang: siteLang,
    assets: PREVIEW.assets,
    inspect: siteInspect,
    logoGuides: siteLogoGuides,
    cart: siteCart,
  };
  const safe = JSON.stringify(config).replaceAll(
    "<",
    String.fromCharCode(92) + "u003c",
  );
  const tag = "scr" + "ipt";
  frame.srcdoc =
    '<!doctype html><html lang="' +
    siteLang +
    '" data-scroll-behavior="smooth"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><base href="about:srcdoc"><style>' +
    decodePreview(PREVIEW.css) +
    '</style></head><body><div id="root"></div><' +
    tag +
    ">window.__KZ_SITE__=" +
    safe +
    ";</" +
    tag +
    "><" +
    tag +
    ' src="' +
    siteScriptURL +
    '"></' +
    tag +
    "></body></html>";
}
function sizeSiteFrame() {
  const frame = $("#site-frame"),
    viewport = $("#site-viewport"),
    scaleBox = $("#site-scale");
  if (!frame || !viewport || !scaleBox) return;
  const width = siteWidths[siteDevice],
    defaultHeight = siteDevice === "mobile" ? 820 : 900;
  const available = viewport.clientWidth - (window.innerWidth < 720 ? 16 : 32);
  const scale = Math.min(1, Math.max(0.15, available / width));
  const availableHeight = Math.max(
    350,
    window.innerHeight - viewport.getBoundingClientRect().top - 50,
  );
  const height = siteExpanded
    ? Math.max(
        400,
        Math.min(defaultHeight, Math.round(availableHeight / scale)),
      )
    : defaultHeight;
  frame.style.width = width + "px";
  frame.style.height = height + "px";
  frame.style.transform = "scale(" + scale + ")";
  scaleBox.style.width = width * scale + "px";
  scaleBox.style.height = height * scale + "px";
  const route = $("#site-route");
  if (route) route.textContent = sitePath + " · " + width + " px";
}
function selectedSiteEditor() {
  if (!siteSelection) return null;
  const route = new URL(sitePath, "https://kuzmin.preview").pathname
    .split("/")
    .filter(Boolean);
  if (
    siteSelection.id.startsWith("home.hero.") &&
    ["home.hero.title", "home.hero.description"].includes(siteSelection.id)
  )
    return {
      table: "content",
      id: state.content.find((c) => c.key === "home")?.id,
      label: "Ana sayfa metnini düzenle",
    };
  const contentKeys = {
    hakkimizda: "about",
    iletisim: "contact",
    sss: "faq",
    "teslimat-iade": "shipping",
    "iptal-iade-kosullari": "shipping",
    "mesafeli-satis-sozlesmesi": "distance-sales",
    "on-bilgilendirme-formu": "pre-information",
    gizlilik: "privacy",
    kosullar: "terms",
  };
  if (siteSelection.id.startsWith("content.") && contentKeys[route[0]])
    return {
      table: "content",
      id: state.content.find((c) => c.key === contentKeys[route[0]])?.id,
      label: "Sayfa metnini düzenle",
    };
  let target = route;
  if (siteSelection.href) {
    try {
      target = new URL(siteSelection.href, "https://kuzmin.preview").pathname
        .split("/")
        .filter(Boolean);
    } catch {}
  }
  if (
    (siteSelection.id.startsWith("product.") ||
      siteSelection.id === "catalog.product-card") &&
    target[0] === "urunler" &&
    target[1]
  )
    return {
      table: "products",
      id: state.products.find((p) => p.slug === target[1])?.id,
      label: "Ürün kaydını düzenle",
    };
  if (
    siteSelection.id.startsWith("motorcycles.") &&
    target[0] === "motosikletler" &&
    target[2]
  )
    return {
      table: "models",
      id: state.models.find(
        (m) =>
          m.slug === target[2] &&
          state.brands.find((b) => b.id === m.brand_id)?.slug === target[1],
      )?.id,
      label: "Motosiklet kaydını düzenle",
    };
  return null;
}
function siteNoteText() {
  if (!siteSelection) return "";
  const editor = selectedSiteEditor();
  return [
    `Sayfa: ${sitePages[sitePage][0]} (${siteLang.toUpperCase()})`,
    `Adres: ${sitePath}`,
    `Görünüm: ${siteDeviceNames[siteDevice]} / ${siteWidths[siteDevice]} px`,
    `Bölüm: ${siteSelection.label}`,
    `Bölüm kodu: ${siteSelection.id}`,
    ...(editor?.id ? [`İçerik kaydı: ${editor.table}/${editor.id}`] : []),
    `Şimdiki metin: ${siteSelection.text || "(Görsel veya kapsayıcı alan)"}`,
    `İstediğim değişiklik: ${siteNote || "(Notunuzu yazın)"}`,
  ].join(String.fromCharCode(10));
}

function paintSiteInspector() {
  const el = $("#site-inspector");
  if (!el) return;
  if (!siteSelection) {
    el.innerHTML =
      '<header><p class="eyebrow">NEYİN NEREDE OLDUĞUNU GÖRÜN</p><h2>Tıkla, değiştir, gör.</h2><p>Düzenleme modunda bir metne veya fotoğrafa tıklayın. Düzenleme araçları burada açılır.</p></header><p>Sayfada gezinmek için düzenleme modunu kapatın veya Müşteri önizlemesi düğmesini kullanın.</p>';
    return;
  }
  const editor = selectedSiteEditor();
  el.innerHTML = `<header><p class="eyebrow">SEÇİLİ BÖLÜM</p><h3>${esc(siteSelection.label)}</h3><span class="site-section-id">${esc(siteSelection.id)}</span></header>${directEditorHTML()}<details class="site-change-note"><summary>Yerleşim değişikliği notu</summary><div><p>Şu an görünen metin</p><div class="site-selection-text">${esc(siteSelection.text || "Görsel veya bölüm alanı seçildi.")}</div></div><div><label>Ne değişsin?<textarea id="site-note" aria-label="Ne değişsin?" placeholder="Örneğin: Bu başlığı biraz küçültelim ve görselin sağ altına taşıyalım.">${esc(siteNote)}</textarea></label></div><div class="site-copy-area"><label>Paylaşılacak değişiklik notu<textarea id="site-copy-text" aria-label="Paylaşılacak değişiklik notu" readonly>${esc(siteNoteText())}</textarea></label><button class="button" data-action="site-copy">Notu kopyala</button><div class="site-note-feedback" id="site-note-feedback" role="status"></div></div>${editor?.id ? `<div class="site-edit-area">${action(editor.label + " ↗", "site-edit", editor.id, "ghost")}<p>Kaydettiğiniz taslak değişikliği önizlemeye yansır.</p></div>` : '<p class="site-edit-area">Bu bölümün yerleşimi veya arayüz metni için değişiklik notunu bana iletebilirsiniz.</p>'}</details>`;
}
function updateSiteRoute(path, language) {
  try {
    const url = new URL(path, "https://kuzmin.preview"),
      p = url.pathname.split("/").filter(Boolean);
    sitePath = url.pathname + url.search;
    siteLang = PREVIEW.languages.includes(language) ? language : "tr";
    if (p[0] === "motosikletler") {
      sitePage = p[3] ? "fitment" : p[2] ? "years" : p[1] ? "models" : "brands";
      const b = state.brands.find((b) => b.slug === p[1]);
      if (b) siteBrand = b.id;
      const m = state.models.find(
        (m) => m.brand_id === siteBrand && m.slug === p[2],
      );
      if (m) siteModel = m.id;
      if (p[3]) siteYear = Number(p[3]);
    } else if (p[0] === "urunler") {
      sitePage = p[1] ? "product" : "catalog";
      const product = state.products.find((v) => v.slug === p[1]);
      if (product) siteProduct = product.id;
    } else {
      const match = Object.entries(sitePages).find(
        ([, v]) => v[1] === url.pathname,
      );
      if (match) sitePage = match[0];
    }
    const dropdown = $("#site-page");
    if (dropdown) dropdown.value = sitePage;
    const languageSelect = $("#site-lang");
    if (languageSelect) languageSelect.value = siteLang;
    const controls = document.querySelector(".site-controls");
    if (controls) {
      controls.querySelectorAll(".site-filter").forEach((n) => n.remove());
      controls
        .querySelector("label")
        .insertAdjacentHTML("afterend", siteFilters());
    }
    siteSelection = null;
    siteNote = "";
    saveSiteUi();
    paintSiteInspector();
    sizeSiteFrame();
    saveSiteUi();
  } catch {}
}
window.addEventListener("message", (event) => {
  const frame = $("#site-frame");
  if (
    !frame ||
    event.source !== frame.contentWindow ||
    !event.data ||
    typeof event.data.type !== "string"
  )
    return;
  const data = event.data;
  if (data.type === "kz-site-ready") {
    $("#site-loading").textContent = "Hazır";
    sizeSiteFrame();
  }
  if (
    data.type === "kz-site-selection" &&
    data.selection &&
    typeof data.selection.id === "string"
  ) {
    siteSelection = {
      id: data.selection.id.slice(0, 120),
      label: String(data.selection.label || "Bölüm").slice(0, 160),
      text: String(data.selection.text || "").slice(0, 600),
      selector: String(data.selection.selector || ""),
      href: String(data.selection.href || ""),
      binding: directBinding(data.selection.binding),
    };
    siteNote = "";
    saveSiteUi();
    paintSiteInspector();
  }
  if (data.type === "kz-site-route" && typeof data.path === "string")
    updateSiteRoute(data.path, data.lang);
  if (data.type === "kz-site-cart" && Array.isArray(data.cart)) {
    siteCart = data.cart.filter(
      (l) =>
        state.products.some((p) => p.id === l.productId) &&
        state.variants.some(
          (v) => v.id === l.variantId && v.product_id === l.productId,
        ) &&
        Number.isInteger(l.quantity) &&
        l.quantity > 0 &&
        l.quantity <= 99,
    );
    siteCartMode = siteCart.length ? "sample" : "empty";
  }
  if (data.type === "kz-site-info")
    toast(String(data.message || "Önizleme bilgisi"));
});
document.addEventListener("change", (event) => {
  const id = event.target.id;
  if (
    ![
      "site-page",
      "site-brand",
      "site-model",
      "site-year",
      "site-product",
      "site-lang",
      "site-cart-mode",
      "site-inspect",
    ].includes(id)
  )
    return;
  if (id === "site-inspect") {
    siteInspect = event.target.checked;
    saveSiteUi();
    document
      .querySelector(".site-preview-grid")
      ?.classList.toggle("has-inspector", siteInspect);
    $("#site-inspector")?.classList.toggle("hidden", !siteInspect);
    $(".site-preview-hint")?.classList.toggle("hidden", !siteInspect);
    sizeSiteFrame();
    $("#site-frame")?.contentWindow.postMessage(
      { type: "kz-site-inspect", enabled: siteInspect },
      "*",
    );
    return;
  }
  if (id === "site-page") sitePage = event.target.value;
  if (id === "site-brand") {
    siteBrand = event.target.value;
    siteModel = "";
    siteYear = 0;
  }
  if (id === "site-model") {
    siteModel = event.target.value;
    siteYear = 0;
  }
  if (id === "site-year") siteYear = Number(event.target.value);
  if (id === "site-product") siteProduct = event.target.value;
  if (id === "site-lang") siteLang = event.target.value;
  if (id === "site-cart-mode") {
    siteCartMode = event.target.value;
    siteCart = siteCartMode === "empty" ? [] : sampleSiteCart();
  }
  siteSelection = null;
  siteNote = "";
  render();
});
document.addEventListener("input", (event) => {
  if (event.target.id === "site-note") {
    siteNote = event.target.value;
    saveSiteUi();
    const field = $("#site-copy-text");
    if (field) field.value = siteNoteText();
  }
});
document.addEventListener("click", async (event) => {
  const el = event.target.closest("[data-action]");
  if (!el) return;
  const a = el.dataset.action;
  if (a === "site-dashboard") {
    siteExpanded = false;
    goto("overview");
    return;
  }
  if (a === "site-refresh") {
    refreshSiteDesign(sitePendingVersion || String(Date.now()));
    return;
  }
  if (a === "site-device" && siteWidths[el.dataset.id]) {
    siteDevice = el.dataset.id;
    saveSiteUi();
    document
      .querySelectorAll('[data-action="site-device"]')
      .forEach((b) =>
        b.setAttribute("aria-pressed", String(b.dataset.id === siteDevice)),
      );
    sizeSiteFrame();
    const field = $("#site-copy-text");
    if (field) field.value = siteNoteText();
  }
  if (a === "site-expand") {
    siteExpanded = !siteExpanded;
    $("#site-preview-shell").classList.toggle(
      "site-preview-expanded",
      siteExpanded,
    );
    el.textContent = siteExpanded ? "Paneli göster" : "Genişlet";
    sizeSiteFrame();
  }
  if (a === "site-edit") {
    const editor = selectedSiteEditor();
    if (editor?.id) openEditor(editor.id, editor.table);
  }
  if (a === "site-copy") {
    const text = siteNoteText();
    const field = $("#site-copy-text");
    field?.focus();
    field?.select();
    try {
      await navigator.clipboard.writeText(text);
      $("#site-note-feedback").textContent =
        "Kopyalandı. Sohbete yapıştırabilirsiniz.";
    } catch {
      $("#site-note-feedback").textContent =
        "Not seçildi. Ctrl+C ile kopyalayıp sohbete yapıştırabilirsiniz.";
    }
  }
});

function refreshSiteDesign(version) {
  saveSiteUi();
  if (location.hostname !== "htmlpreview.github.io") {
    location.reload();
    return;
  }
  const source =
    "https://raw.githubusercontent.com/gsgvhlcglf-blip/dassda/main/docs/panel.html?v=" +
    encodeURIComponent(version);
  window.location.href =
    "https://htmlpreview.github.io/?" + source + "#onizleme";
}
async function checkSiteDesign() {
  if (
    siteUpdateBusy ||
    document.hidden ||
    location.hostname !== "htmlpreview.github.io"
  )
    return;
  siteUpdateBusy = true;
  try {
    const response = await fetch(
      "https://raw.githubusercontent.com/gsgvhlcglf-blip/dassda/main/docs/panel-version.json?t=" +
        Date.now(),
      { cache: "no-store", credentials: "omit", referrerPolicy: "no-referrer" },
    );
    if (!response.ok) throw Error("Version unavailable");
    const metadata = await response.json();
    if (
      typeof metadata.version !== "string" ||
      !/^[a-f0-9]{16}$/.test(metadata.version)
    )
      throw Error("Invalid version");
    const publishedAt =
      typeof metadata.built_at === "string"
        ? Date.parse(metadata.built_at)
        : NaN;
    const loadedAt =
      typeof PREVIEW.built_at === "string" ? Date.parse(PREVIEW.built_at) : NaN;
    if (
      Number.isFinite(publishedAt) &&
      Number.isFinite(loadedAt) &&
      publishedAt < loadedAt
    )
      return;
    if (metadata.version !== PREVIEW.version) {
      sitePendingVersion = metadata.version;
      const status = $("#site-update-status");
      if (status) status.textContent = "Yeni tasarım hazır";
      if (
        !$("#editor").open &&
        !siteDirectDirty &&
        !$("#site-frame")?.contentDocument?.querySelector(
          "[data-inline-editing]",
        )
      )
        refreshSiteDesign(metadata.version);
    } else {
      const status = $("#site-update-status");
      if (status) status.textContent = "Tasarım güncel";
    }
  } catch {
    const status = $("#site-update-status");
    if (status) status.textContent = "Güncelleme bağlantısı bekleniyor";
  } finally {
    siteUpdateBusy = false;
  }
}
setInterval(checkSiteDesign, 8000);
window.addEventListener("focus", checkSiteDesign);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) checkSiteDesign();
});
setTimeout(checkSiteDesign, 1000);
