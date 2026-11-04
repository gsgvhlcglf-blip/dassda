/** @returns {{texts: Record<string, Record<string, string>>, images: Record<string, string>, logoScales: Record<string, number>}} */
export function validateDesign(value) {
  if (value == null) return { texts: {}, images: {}, logoScales: {} };
  if (
    typeof value !== "object" ||
    Array.isArray(value) ||
    !value.texts ||
    !value.images
  )
    throw Error("Görsel taslak geçersiz.");
  const result = { texts: {}, images: {}, logoScales: {} };
  for (const lang of ["tr", "en", "ru"]) {
    const entries = value.texts[lang] || {};
    result.texts[lang] = {};
    for (const [key, text] of Object.entries(entries)) {
      if (
        !/^(ui:[a-zA-Z][a-zA-Z0-9]*|slot:[a-z.]+)$/.test(key) ||
        typeof text !== "string" ||
        text.length > 12000
      )
        throw Error("Görsel taslak metni geçersiz.");
      result.texts[lang][key] = text;
    }
  }
  for (const [key, url] of Object.entries(value.images)) {
    if (
      !/^(home\.[a-z.]+|brand:[a-z0-9_-]+)$/.test(key) ||
      typeof url !== "string" ||
      url.length > 2000000 ||
      !/^data:image\/webp;base64,[a-zA-Z0-9+/=]+$/.test(url)
    )
      throw Error("Görsel taslak fotoğrafı geçersiz.");
    result.images[key] = url;
  }
  if (
    value.logoScales != null &&
    (typeof value.logoScales !== "object" || Array.isArray(value.logoScales))
  )
    throw Error("Logo ölçek ayarları geçersiz.");
  for (const [key, scale] of Object.entries(value.logoScales || {})) {
    if (
      !/^brand:[a-z0-9_-]+$/.test(key) ||
      !Number.isInteger(scale) ||
      scale < 50 ||
      scale > 200
    )
      throw Error("Logo ölçeği %50 ile %200 arasında olmalıdır.");
    result.logoScales[key] = scale;
  }
  return result;
}
