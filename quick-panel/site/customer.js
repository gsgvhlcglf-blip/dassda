(async () => {
  const KEY = "kuzmin.workspace.gsgvhlcglf-blip.dassda.v1";
  const INITIAL = __SEED__;
  const PREVIEW = __SITE_PREVIEW__;
  /*__DESIGN_VALIDATOR__*/
  /*__CATALOG_UPDATES__*/
  const outerQuery = location.search.slice(1);
  let viewMode = "published";
  try {
    const url = outerQuery.startsWith("https://")
      ? new URL(outerQuery)
      : new URL(location.href);
    if (url.searchParams.get("workspace-view") === "draft") viewMode = "draft";
  } catch {}
  let catalog = INITIAL,
    design = { texts: {}, images: {} };
  try {
    if (viewMode !== "draft") {
      const published = await KZ_VERSIONS.browserPublished({
        catalog: INITIAL,
        design: validateDesign(null),
      });
      catalog = published.catalog;
      design = published.design;
    }
    const saved =
      viewMode === "draft"
        ? JSON.parse(localStorage.getItem(KEY) || "null")
        : null;
    if (saved && Array.isArray(saved.products) && Array.isArray(saved.models))
      catalog = saved;
    const applied = JSON.parse(
      localStorage.getItem(KEY + ".catalog-updates") || "[]",
    );
    if (viewMode === "draft")
      catalog = applyCatalogUpdates(catalog, PREVIEW.updates, applied).catalog;
    if (viewMode === "draft")
      design = validateDesign(
        JSON.parse(localStorage.getItem(KEY + ".design") || "null"),
      );
  } catch {
    /* A clean browser starts with the clearly labelled demo catalog. */
  }
  const path = location.hash.startsWith("#/") ? location.hash.slice(1) : "/";
  const lang = new URL(path, "https://kuzmin.preview").searchParams.get("lang");
  window.__KZ_SITE__ = {
    catalog,
    design,
    path,
    lang: lang === "en" || lang === "ru" ? lang : "tr",
    assets: PREVIEW.assets,
    inspect: false,
    cart: [],
    standalone: true,
    storageKey: KEY,
    revision: PREVIEW.version,
    viewMode,
    fallbackCatalog: INITIAL,
  };
  const code = new TextDecoder().decode(
    Uint8Array.from(atob(PREVIEW.js), (c) => c.charCodeAt(0)),
  );
  const script = document.createElement("scr" + "ipt");
  script.src = URL.createObjectURL(
    new Blob([code], { type: "text/javascript" }),
  );
  script.onerror = () => {
    document.getElementById("root").textContent =
      "Önizleme açılamadı. Sayfayı yenileyin.";
  };
  document.body.appendChild(script);
})();
