let siteDesign = { texts: {}, images: {} };
try {
  siteDesign = validateDesign(
    JSON.parse(localStorage.getItem(KEY + ".design") || "null"),
  );
} catch {}
let siteDirectDirty = false;
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
  if (binding.type === "image") return siteSelection.text;
  const [table, id, field] = binding.key.split(":");
  const value = state[table].find((r) => r.id === id)?.[field];
  return typeof value === "object" ? value[binding.lang] : value;
}
function directEditorHTML() {
  const b = directBinding(siteSelection?.binding);
  if (!b)
    return "<p>Bu alanın içeriği seçime göre hesaplanır. Ayrıntılı kaydı düzenleyebilir veya yerleşim isteğinizi aşağıya yazabilirsiniz.</p>";
  if (b.type === "image")
    return `<section class="site-direct-editor"><h3>Fotoğrafı değiştir</h3>${directValue(b) ? `<img class="site-direct-photo" src="${esc(directValue(b))}" alt="Seçili fotoğraf">` : ""}<label class="site-upload-label">Yeni fotoğraf seç<input id="site-photo" type="file" accept="image/jpeg,image/png,image/webp" aria-label="Yeni fotoğraf seç"></label><p>JPEG, PNG veya WebP · En fazla 5 MB. Seçtiğiniz fotoğraf hemen görünür.</p><div id="site-direct-status" role="status"></div></section>`;
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
  if (event.target.id !== "site-direct-text") return;
  siteDirectDirty = true;
  saveDirect(siteSelection?.binding, event.target.value);
});
document.addEventListener("change", async (event) => {
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
  if (event.target.closest('[data-action="site-customer"]'))
    window.open(customerPreviewURL(), "_blank", "noopener");
});
window.addEventListener("message", (event) => {
  if (event.source !== $("#site-frame")?.contentWindow) return;
  if (event.data?.type === "kz-site-edit")
    saveDirect(event.data.binding, event.data.value, true);
  if (event.data?.type === "kz-site-inline-end") {
    if (!siteDirectDirty) sendSiteConfig();
  }
});
