/** @returns {{texts: Record<string, Record<string, string>>, images: Record<string, string>, heroVideo?: import("../src/lib/hero-video").HeroVideoAsset, logoScales: Record<string, number>, logoOffsets: Record<string,{x:number,y:number}>, photography: import("../src/lib/photography").Photography, photoFrames: Record<string,import("../src/lib/photography").PhotoFrame>}} */
export function validateDesign(value) {
  if (value == null)
    return {
      texts: {},
      images: {},
      logoScales: {},
      logoOffsets: {},
      photography: {
        aspect: "square",
        background: "dark",
        fit: "contain",
        scale: 90,
      },
      photoFrames: {},
    };
  if (
    typeof value !== "object" ||
    Array.isArray(value) ||
    !value.texts ||
    !value.images
  )
    throw Error("Görsel taslak geçersiz.");
  const result = {
    texts: {},
    images: {},
    logoScales: {},
    logoOffsets: {},
    photography: {
      aspect: "square",
      background: "dark",
      fit: "contain",
      scale: 90,
    },
    photoFrames: {},
  };
  if (value.heroVideo != null) {
    const video = value.heroVideo;
    let safeSource = false;
    if (video && typeof video.src === "string" && video.src.length <= 2048) {
      safeSource =
        /^\/api\/upload-video\?file=[a-f0-9-]{36}\.(mp4|webm)$/.test(
          video.src,
        ) ||
        /^idb:[a-f0-9-]{36}$/.test(video.src) ||
        /^\/uploads\/[a-f0-9-]+\.(mp4|webm)$/.test(video.src);
      if (!safeSource) {
        try {
          const url = new URL(video.src);
          safeSource =
            url.protocol === "https:" &&
            !!url.hostname &&
            !url.username &&
            !url.password;
        } catch {}
      }
    }
    if (
      !safeSource ||
      typeof video.name !== "string" ||
      video.name.length > 200 ||
      !["video/mp4", "video/webm"].includes(video.mime) ||
      !Number.isInteger(video.size) ||
      video.size < 12 ||
      video.size > 50 * 1024 * 1024
    )
      throw Error(
        "Banner videosu geçersiz. MP4/WebM ve en fazla 50 MB kullanın.",
      );
    result.heroVideo = {
      src: video.src,
      name: video.name,
      mime: video.mime,
      size: video.size,
    };
  }
  for (const lang of ["tr", "en", "ru"]) {
    const entries = value.texts[lang] || {};
    result.texts[lang] = {};
    for (const [key, text] of Object.entries(entries)) {
      if (
        !/^(ui:[a-zA-Z][a-zA-Z0-9_]*|slot:[a-z.]+)$/.test(key) ||
        typeof text !== "string" ||
        text.length > 12000
      )
        throw Error("Görsel taslak metni geçersiz.");
      result.texts[lang][key] = text;
    }
  }
  for (const [key, url] of Object.entries(value.images)) {
    if (
      !/^((home|requests)\.[a-z_.]+|brand:[a-z0-9_-]+|bestseller:[a-zA-Z0-9_-]+|blog:[a-zA-Z0-9_-]+)$/.test(
        key,
      ) ||
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
  if (
    value.logoOffsets != null &&
    (typeof value.logoOffsets !== "object" || Array.isArray(value.logoOffsets))
  )
    throw Error("Logo hizalama ayarı geçersiz.");
  for (const [key, offset] of Object.entries(value.logoOffsets || {})) {
    if (
      !/^brand:[a-z0-9_-]+$/.test(key) ||
      !offset ||
      typeof offset !== "object" ||
      !Number.isFinite(offset.x) ||
      !Number.isFinite(offset.y) ||
      Math.abs(offset.x) > 112 ||
      Math.abs(offset.y) > 112
    )
      throw Error("Logo hizalama ayarı geçersiz.");
    result.logoOffsets[key] = { x: offset.x, y: offset.y };
  }
  const photo = value.photography;
  if (photo != null) {
    if (
      !photo ||
      !["square", "portrait", "landscape"].includes(photo.aspect) ||
      !["dark", "light", "original"].includes(photo.background) ||
      !["contain", "cover"].includes(photo.fit) ||
      !Number.isInteger(photo.scale) ||
      photo.scale < 60 ||
      photo.scale > 120
    )
      throw Error("Fotoğraf düzeni geçersiz.");
    result.photography = {
      aspect: photo.aspect,
      background: photo.background,
      fit: photo.fit,
      scale: photo.scale,
    };
  }
  if (
    value.photoFrames != null &&
    (typeof value.photoFrames !== "object" || Array.isArray(value.photoFrames))
  )
    throw Error("Fotoğraf kadrajları geçersiz.");
  for (const [key, frame] of Object.entries(value.photoFrames || {})) {
    if (
      !/^(image|product):[a-zA-Z0-9_-]+$/.test(key) ||
      !frame ||
      !Number.isInteger(frame.scale) ||
      frame.scale < 50 ||
      frame.scale > 160 ||
      !Number.isFinite(frame.x) ||
      frame.x < 0 ||
      frame.x > 100 ||
      !Number.isFinite(frame.y) ||
      frame.y < 0 ||
      frame.y > 100 ||
      !["overview", "texture", "finish", "installed", "mounting"].includes(
        frame.role,
      )
    )
      throw Error("Fotoğraf kadrajı geçersiz.");
    result.photoFrames[key] = {
      scale: frame.scale,
      x: frame.x,
      y: frame.y,
      role: frame.role,
    };
  }
  return result;
}
