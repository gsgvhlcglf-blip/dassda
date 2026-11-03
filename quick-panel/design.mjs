export function validateDesign(value) {
  if (value == null) return { texts: {}, images: {} };
  if (
    typeof value !== "object" ||
    Array.isArray(value) ||
    !value.texts ||
    !value.images
  )
    throw Error("Görsel taslak geçersiz.");
  const result = { texts: {}, images: {} };
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
  return result;
}
