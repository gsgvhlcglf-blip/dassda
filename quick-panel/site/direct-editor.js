let siteDesign = { texts: {}, images: {} };
try {
  siteDesign = validateDesign(
    JSON.parse(localStorage.getItem(KEY + ".design") || "null"),
  );
} catch {}
let siteDirectDirty = false;
let logoAlignmentRequest = "";
let logoAlignmentSequence = 0;
function directBinding(binding) {
  if (
    !binding ||
    !["tr", "en", "ru"].includes(binding.lang) ||
    typeof binding.key !== "string"
  )
    return null;
  if (
    binding.type === "text" &&
    /^(ui:[a-zA-Z][a-zA-Z0-9]*|slot:[a-z.]+)$/.test(binding.key)
  )
    return binding;
  if (
    binding.type === "image" &&
    /^(home\.[a-z.]+|brand:[a-z0-9_-]+|model:[a-z0-9_-]+|product:[a-z0-9_-]+|image:[a-z0-9_-]+)$/.test(
      binding.key,
    )
  )
    return binding;
  if (binding.type === "record") {
    const [table, id, field] = binding.key.split(":");
    const fields = {
      content: ["title", "body"],
      products: [
        "title",
        "description",
        "specifications",
        "installation",
        "price",
      ],
      models: ["name"],
      variants: ["price"],
    };
    if (fields[table]?.includes(field) && state[table].some((r) => r.id === id))
      return binding;
  }
  return null;
}
function sendSiteConfig() {
  $("#site-frame")?.contentWindow.postMessage(
    { type: "kz-site-config", catalog: state, design: siteDesign },
    "*",
  );
}
function directValue(binding) {
  if (binding.type === "text")
    return siteDesign.texts[binding.lang]?.[binding.key] ?? siteSelection.text;
  if (binding.type === "image") {
    const [kind, id] = binding.key.split(":");
    if (kind === "brand") return siteDesign.images[binding.key] || "";
    if (kind === "model")
      return state.models.find((model) => model.id === id)?.image || "";
    if (kind === "image")
      return state.product_images.find((image) => image.id === id)?.url || "";
    if (kind === "product")
      return (
        state.product_images
          .filter((image) => image.product_id === id)
          .sort((a, b) => a.position - b.position)[0]?.url || ""
      );
    const defaults = {
      "home.hero": "/images/hero.webp",
      "home.collection.body": "/images/carbon.svg",
      "home.collection.details": "/images/hero.webp",
      "home.craft": "/images/carbon.svg",
    };
    return (
      siteDesign.images[binding.key] ||
      PREVIEW.assets[defaults[binding.key]] ||
      ""
    );
  }
  const [table, id, field] = binding.key.split(":");
  const value = state[table].find((r) => r.id === id)?.[field];
  return typeof value === "object" ? value[binding.lang] : value;
}
function logoScaleHTML(binding) {
  if (!binding.key.startsWith("brand:")) return "";
  const scale = siteDesign.logoScales?.[binding.key] ?? 100;
  return `<div class="site-logo-scale"><p class="eyebrow">${esc(state.brands.find((brand) => "brand:" + brand.id === binding.key)?.name || "")}</p><label for="site-logo-scale">Logo ölçeği <output id="site-logo-scale-value" for="site-logo-scale">%${scale}</output></label><input id="site-logo-scale" data-logo-key="${esc(binding.key)}" aria-label="Logo ölçeği" type="range" min="50" max="200" step="1" value="${scale}"><div class="site-scale-limits"><span>%50</span><span>%200</span></div><label class="site-guide-toggle"><input type="checkbox" id="site-logo-guides" ${siteLogoGuides ? "checked" : ""}>Hizalama kılavuzu</label><button class="button" type="button" id="site-logo-align" data-action="site-logo-align">Hepsini hizala</button><p>Seçili logonun görünen yüksekliğini baz alır; tüm logoları ortalar.</p><button class="ghost" type="button" data-action="site-logo-scale-reset">Varsayılan boyuta dön</button><p>Bu logonun boyutunu ayarlar. Alt yazı sabit kalır. Değişiklik otomatik kaydedilir.</p></div>`;
}
function setLogoGuidesEnabled(enabled) {
  siteLogoGuides = Boolean(enabled);
  saveSiteUi();
  if ($("#site-logo-guides")) $("#site-logo-guides").checked = siteLogoGuides;
  $("#site-frame")?.contentWindow.postMessage(
    { type: "kz-site-logo-guides", enabled: siteLogoGuides },
    "*",
  );
}
function requestLogoAlignment() {
  const binding = directBinding(siteSelection?.binding),
    frame = $("#site-frame");
  if (
    !siteInspect ||
    binding?.type !== "image" ||
    !binding.key.startsWith("brand:") ||
    !frame
  )
    return;
  logoAlignmentRequest = "logo-align-" + ++logoAlignmentSequence;
  if ($("#site-logo-align")) $("#site-logo-align").disabled = true;
  if ($("#site-direct-status"))
    $("#site-direct-status").textContent = "Logolar hizalanıyor…";
  frame.contentWindow.postMessage(
    {
      type: "kz-site-logo-align",
      referenceKey: binding.key,
      requestId: logoAlignmentRequest,
    },
    "*",
  );
}
function receiveLogoAlignment(data) {
  if (!logoAlignmentRequest || data.requestId !== logoAlignmentRequest) return;
  logoAlignmentRequest = "";
  const status = $("#site-direct-status");
  try {
    if (data.error) throw Error(String(data.error));
    const keys = state.brands.map((brand) => "brand:" + brand.id);
    if (
      !data.scales ||
      !data.offsets ||
      Object.keys(data.scales).length !== keys.length ||
      Object.keys(data.offsets).length !== keys.length ||
      !keys.every(
        (key) =>
          Object.hasOwn(data.scales, key) && Object.hasOwn(data.offsets, key),
      )
    )
      throw Error("Logo hizalama verileri alınamadı.");
    const next = validateDesign({
      ...siteDesign,
      logoScales: { ...siteDesign.logoScales, ...data.scales },
      logoOffsets: { ...siteDesign.logoOffsets, ...data.offsets },
    });
    localStorage.setItem(KEY + ".design", JSON.stringify(next));
    siteDesign = next;
    siteDirectDirty = false;
    sendSiteConfig();
    const key = siteSelection?.binding?.key,
      scale = siteDesign.logoScales[key] ?? 100;
    if ($("#site-logo-scale")) $("#site-logo-scale").value = String(scale);
    if ($("#site-logo-scale-value"))
      $("#site-logo-scale-value").textContent = "%" + scale;
    if (status) {
      status.setAttribute("role", "status");
      status.textContent = data.limited
        ? data.sizesMatched === false
          ? "Logolar ortalandı; %50–%200 sınırı nedeniyle yükseklikler tam eşitlenemedi."
          : "Logolar ortak yüksekliğe hizalandı ve kaydedildi. Ölçek sınırları dikkate alındı."
        : "✓ Tüm logolar hizalandı ve kaydedildi.";
    }
  } catch (error) {
    siteDirectDirty = true;
    if (status) {
      status.setAttribute("role", "alert");
      status.textContent =
        error.name === "QuotaExceededError"
          ? "Tarayıcı alanı dolu. Önce taslağınızı yedekleyin."
          : error.message;
    }
  } finally {
    if ($("#site-logo-align")) $("#site-logo-align").disabled = false;
  }
}
function saveLogoScale(value) {
  const binding = directBinding(siteSelection?.binding);
  if (
    binding?.type !== "image" ||
    !binding.key.startsWith("brand:") ||
    !state.brands.some((brand) => "brand:" + brand.id === binding.key)
  )
    return;
  try {
    const scale = Number(value);
    const design = validateDesign({
      ...siteDesign,
      logoScales: { ...siteDesign.logoScales, [binding.key]: scale },
    });
    localStorage.setItem(KEY + ".design", JSON.stringify(design));
    siteDesign = design;
    siteDirectDirty = false;
    sendSiteConfig();
    const output = $("#site-logo-scale-value"),
      slider = $("#site-logo-scale"),
      status = $("#site-direct-status");
    if (output) output.textContent = "%" + scale;
    if (slider) slider.value = String(scale);
    if (status) {
      status.setAttribute("role", "status");
      status.textContent = "✓ Kaydedildi · Logo ölçeği güncel";
    }
  } catch (error) {
    siteDirectDirty = true;
    const status = $("#site-direct-status");
    if (status) {
      status.setAttribute("role", "alert");
      status.textContent =
        error.name === "QuotaExceededError"
          ? "Tarayıcı alanı dolu. Önce taslağınızı yedekleyin."
          : error.message;
    }
  }
}
function directEditorHTML() {
  const b = directBinding(siteSelection?.binding);
  if (!b)
    return "<p>Bu alanın içeriği seçime göre hesaplanır. Ayrıntılı kaydı düzenleyebilir veya yerleşim isteğinizi aşağıya yazabilirsiniz.</p>";
  if (b.type === "image")
    return `<section class="site-direct-editor"><h3>${b.key.startsWith("brand:") ? "Logo ayarları" : "Fotoğrafı değiştir"}</h3>${directValue(b) ? `<img class="site-direct-photo" src="${esc(directValue(b))}" alt="Seçili fotoğraf">` : ""}${logoScaleHTML(b)}<label class="site-upload-label">Yeni fotoğraf seç<input id="site-photo" type="file" accept="image/jpeg,image/png,image/webp" aria-label="Yeni fotoğraf seç"></label><p>JPEG, PNG veya WebP · En fazla 5 MB. Seçtiğiniz fotoğraf hemen görünür.</p><div id="site-direct-status" role="status"></div></section>`;
  const number = b.key.endsWith(":price");
  return `<section class="site-direct-editor"><h3>${number ? "Fiyatı değiştir (TRY)" : "Metni düzenle"}</h3><label>${b.lang.toUpperCase()} ${number ? `<input id="site-direct-text" aria-label="Seçili metni düzenle" type="number" min="0" step="1" value="${esc(directValue(b))}">` : `<textarea id="site-direct-text" aria-label="Seçili metni düzenle" maxlength="12000">${esc(directValue(b))}</textarea>`}</label><p>Yazarken önizleme güncellenir ve bu tarayıcıya kaydedilir.${number ? "" : " Düz metinlere doğrudan sayfanın üzerinde de yazabilirsiniz."}</p><div id="site-direct-status" role="status">Kaydedildi</div></section>`;
}
function saveDirect(binding, value, inline = false) {
  const b = directBinding(binding);
  if (!b) return;
  const next = clone(state),
    design = clone(siteDesign);
  try {
    if (b.type === "text") {
      if (typeof value !== "string" || value.length > 12000)
        throw Error("Metin en fazla 12.000 karakter olabilir.");
      (design.texts[b.lang] ||= {})[b.key] = value;
    } else if (b.type === "record") {
      const [table, id, field] = b.key.split(":");
      const row = next[table].find((r) => r.id === id);
      if (field === "price") {
        const amount = Number(value);
        if (
          String(value).trim() === "" ||
          !Number.isSafeInteger(amount) ||
          amount < 0
        )
          throw Error("Sıfır veya daha büyük bir tam sayı girin.");
        row.price = amount;
        if (table === "products")
          next.variants
            .filter((v) => v.product_id === id)
            .forEach((v) => (v.price = amount));
      } else if (typeof row[field] === "object") row[field][b.lang] = value;
      else row[field] = value;
    } else {
      if (!/^data:image\/webp;base64,[a-zA-Z0-9+/=]+$/.test(value))
        throw Error("Görsel işlenemedi.");
      const [type, id] = b.key.split(":");
      if (type === "model") next.models.find((m) => m.id === id).image = value;
      else if (type === "image")
        next.product_images.find((i) => i.id === id).url = value;
      else if (type === "product") {
        const image = next.product_images
          .filter((i) => i.product_id === id)
          .sort((a, b) => a.position - b.position)[0];
        if (image) image.url = value;
        else
          next.product_images.push({
            id: uid("img"),
            product_id: id,
            url: value,
            alt: {
              tr: "Ürün fotoğrafı",
              en: "Product photograph",
              ru: "Фото товара",
            },
            position: 0,
          });
      } else design.images[b.key] = value;
    }
    validate(next);
    validateDesign(design);
    // Each edit touches only one storage record, retaining the existing catalog draft.
    if (
      b.type === "text" ||
      (b.type === "image" &&
        (!b.key.includes(":") || b.key.startsWith("brand:")))
    )
      localStorage.setItem(KEY + ".design", JSON.stringify(design));
    else localStorage.setItem(KEY, JSON.stringify(next));
    state = next;
    siteDesign = design;
    siteSelection.text = value;
    siteDirectDirty = false;
    if (!inline) sendSiteConfig();
    const status = $("#site-direct-status");
    if (status) status.textContent = "✓ Kaydedildi · Önizleme güncel";
    if (inline && $("#site-direct-text")) $("#site-direct-text").value = value;
  } catch (error) {
    siteDirectDirty = true;
    const message =
      error.name === "QuotaExceededError"
        ? "Tarayıcı alanı dolu. Taslağı yedekleyin veya daha küçük bir fotoğraf seçin."
        : error.message;
    const status = $("#site-direct-status");
    if (status) {
      status.textContent = message;
      status.setAttribute("role", "alert");
    }
  }
}
function customerPreviewURL() {
  const path =
    sitePath +
    (siteLang === "tr" || sitePath.includes("lang=")
      ? ""
      : (sitePath.includes("?") ? "&" : "?") + "lang=" + siteLang);
  return location.hostname === "htmlpreview.github.io"
    ? "https://htmlpreview.github.io/?https://raw.githubusercontent.com/gsgvhlcglf-blip/dassda/main/docs/store.html?v=" +
        PREVIEW.version +
        "#" +
        path
    : new URL("store.html#" + path, location.href).href;
}
document.addEventListener("input", (event) => {
  if (event.target.id === "site-logo-scale") {
    saveLogoScale(event.target.value);
    return;
  }
  if (event.target.id !== "site-direct-text") return;
  siteDirectDirty = true;
  saveDirect(siteSelection?.binding, event.target.value);
});
document.addEventListener("change", async (event) => {
  if (event.target.id === "site-logo-guides") {
    setLogoGuidesEnabled(event.target.checked);
    return;
  }
  if (event.target.id !== "site-photo") return;
  const binding = siteSelection?.binding;
  try {
    const file = event.target.files[0];
    if (!file) return;
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size > 5 * 1024 * 1024
    )
      throw Error("JPEG, PNG veya WebP seçin (en fazla 5 MB).");
    const bitmap = await createImageBitmap(file),
      canvas = document.createElement("canvas");
    const ratio = Math.min(1, 1440 / Math.max(bitmap.width, bitmap.height));
    canvas.width = Math.max(1, Math.round(bitmap.width * ratio));
    canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
    canvas
      .getContext("2d")
      .drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    saveDirect(binding, canvas.toDataURL("image/webp", 0.82));
    if (!siteDirectDirty) paintSiteInspector();
  } catch (error) {
    const status = $("#site-direct-status");
    if (status) status.textContent = error.message;
  }
});
document.addEventListener("click", (event) => {
  if (event.target.closest('[data-action="site-logo-align"]')) {
    requestLogoAlignment();
    return;
  }
  if (event.target.closest('[data-action="site-logo-scale-reset"]')) {
    saveLogoScale(100);
    return;
  }
  if (event.target.closest('[data-action="site-customer"]'))
    window.open(customerPreviewURL(), "_blank", "noopener");
});
window.addEventListener("message", (event) => {
  if (event.source !== $("#site-frame")?.contentWindow) return;
  if (event.data?.type === "kz-site-logo-guides-close")
    setLogoGuidesEnabled(false);
  if (event.data?.type === "kz-site-logo-aligned")
    receiveLogoAlignment(event.data);
  if (event.data?.type === "kz-site-edit")
    saveDirect(event.data.binding, event.data.value, true);
  if (event.data?.type === "kz-site-inline-end") {
    if (!siteDirectDirty) sendSiteConfig();
  }
});
