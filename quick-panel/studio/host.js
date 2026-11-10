function workspaceSnapshot() {
  return { catalog: clone(state), design: validateDesign(siteDesign) };
}
function studioCustomerURL(mode = "published") {
  const source = location.search.slice(1),
    path = sitePath || "/";
  if (
    /^https:\/\/raw\.githubusercontent\.com\/gsgvhlcglf-blip\/dassda\/[^/]+\/docs\/panel\.html(?:\?|$)/.test(
      source,
    )
  ) {
    const url = new URL(source.replace("/panel.html", "/store.html"));
    url.searchParams.set("workspace-view", mode);
    return "https://htmlpreview.github.io/?" + url.href + "#" + path;
  }
  const url = new URL("store.html", location.href);
  url.searchParams.set("workspace-view", mode);
  url.hash = path;
  return url.href;
}
async function renderReleaseWorkspace(view) {
  view.innerHTML = '<p class="muted" role="status">Sürümler yükleniyor…</p>';
  try {
    const data = await KZ_VERSIONS.browserVersions();
    if (section !== "releases") return;
    view.innerHTML = `<section class="box"><p class="eyebrow">TASLAK → YAYIN → GERİ AL</p><h2>Son söz sizde.</h2><p class="muted">Düzenlemeler otomatik olarak taslağa kaydedilir. Yayımlanan görünüm yalnızca Yayınla dediğinizde değişir.</p><p class="help">Bu çalışma alanındaki yayın aynı tarayıcıda saklanır; internete açık bir mağaza yayımlamaz. Canlı uygulamanın yönetim panelinde aynı akış veritabanına bağlı çalışır.</p><label>Sürüm adı<input id="studio-release-label" maxlength="120" value="${esc(new Date().toLocaleString("tr-TR"))}"></label><div class="actions">${action("Taslağı yayınla", "studio-publish")}${action("Taslak önizlemesi ↗", "studio-draft", "", "button secondary")}${action("Yayımlananı gör ↗", "studio-published", "", "button secondary")}</div><p id="studio-release-status" role="status"></p></section><section class="box" style="margin-top:20px"><h2>Sürüm geçmişi</h2><p class="muted">Son 12 sürüm bu tarayıcıda saklanır. Geri alma öncesindeki taslak ayrıca korunur. Tarayıcı verilerini silmek geçmişi de siler.</p>${data.history.length ? data.history.map((v) => `<div class="studio-version"><div><strong>${esc(v.label)} ${data.current === v.id ? "· Şu an yayında" : ""}</strong><p>${esc(new Date(v.created_at).toLocaleString("tr-TR"))} · ${v.kind === "draft_backup" ? "Taslak yedeği" : "Yayın"}</p></div>${data.current === v.id ? "" : action("Bu sürüme dön", "studio-restore", v.id, "button secondary")}</div>`).join("") : '<p class="empty">İlk yayınınızdan sonra sürümler burada görünür.</p>'}</section>`;
  } catch (error) {
    view.innerHTML = `<p role="alert">${esc(error.message)}</p>`;
  }
}
async function publishStudioVersion(restoreId) {
  if (siteDirectDirty || $("#editor").open) {
    toast("Önce açık düzenlemeyi kaydedin veya kapatın.");
    return;
  }
  const before = workspaceSnapshot();
  let restored = false;
  try {
    const data = await KZ_VERSIONS.browserVersions();
    let target = before;
    if (restoreId) {
      const version = data.history.find((v) => v.id === restoreId);
      if (!version) throw Error("Sürüm bulunamadı.");
      if (
        !confirm(
          "Bu sürüme dönülsün mü? Mevcut taslağınız sürüm geçmişine yedeklenir.",
        )
      )
        return;
      target = version.snapshot;
      validate(target.catalog);
      target.design = validateDesign(target.design);
    }
    if (!data.current)
      await KZ_VERSIONS.publishBrowserSnapshot(
        { catalog: clone(INITIAL), design: validateDesign(null) },
        "İlk yayın öncesi",
      );
    if (restoreId) {
      writeStudioDraft(target);
      restored = true;
    }
    const label = restoreId
      ? "Geri yüklenen yayın"
      : $("#studio-release-label")?.value.trim() || "Yayın";
    await KZ_VERSIONS.publishBrowserSnapshot(
      target,
      label,
      restoreId ? before : undefined,
    );
    toast(
      restoreId
        ? "Sürüm geri yüklendi. Önceki taslağınız geçmişte korunuyor."
        : "Taslak yayımlanan görünüme aktarıldı.",
    );
    if (section === "releases") await renderReleaseWorkspace($("#view"));
  } catch (error) {
    if (restored) {
      try {
        writeStudioDraft(before);
      } catch {}
    }
    toast(error.message);
  }
}
function writeStudioDraft(snapshot) {
  const oldCatalog = localStorage.getItem(KEY),
    oldDesign = localStorage.getItem(KEY + ".design");
  try {
    localStorage.setItem(KEY, JSON.stringify(snapshot.catalog));
    localStorage.setItem(KEY + ".design", JSON.stringify(snapshot.design));
  } catch (error) {
    if (oldCatalog !== null) localStorage.setItem(KEY, oldCatalog);
    if (oldDesign !== null) localStorage.setItem(KEY + ".design", oldDesign);
    throw error;
  }
  state = clone(snapshot.catalog);
  siteDesign = validateDesign(snapshot.design);
  sendSiteConfig();
}
function studioPhotoOptions(options, current) {
  return options
    .map(
      ([value, label]) =>
        `<option value="${value}" ${current === value ? "selected" : ""}>${label}</option>`,
    )
    .join("");
}
function renderPhotoWorkspace(view) {
  const p = validateDesign(siteDesign).photography;
  view.innerHTML = `<section class="box"><p class="eyebrow">ÜRÜN FOTOĞRAF STÜDYOSU</p><h2>Ortak kadraj, tutarlı sunum.</h2><p class="muted">Ayarlar tüm ürün kartlarına ve galerilere uygulanır. Orijinal fotoğraflar değiştirilmez. Arka plan rengi saydam görsellerde etkilidir.</p><div class="studio-photo-controls"><label>Kadraj<select id="studio-photo-aspect">${studioPhotoOptions(
    [
      ["square", "Kare · 1:1"],
      ["portrait", "Dikey · 4:5"],
      ["landscape", "Yatay · 4:3"],
    ],
    p.aspect,
  )}</select></label><label>Arka plan<select id="studio-photo-background">${studioPhotoOptions(
    [
      ["dark", "Koyu stüdyo"],
      ["light", "Açık stüdyo"],
      ["original", "Mevcut arka plan"],
    ],
    p.background,
  )}</select></label><label>Yerleşim<select id="studio-photo-fit">${studioPhotoOptions(
    [
      ["contain", "Ürünün tamamını göster"],
      ["cover", "Kadrajı doldur"],
    ],
    p.fit,
  )}</select></label><label>Ortak ölçek <output id="studio-photo-output">%${p.scale}</output><input type="range" id="studio-photo-scale" aria-label="Ortak fotoğraf ölçeği" min="60" max="120" value="${p.scale}"></label></div><p class="help">Taslağa otomatik kaydedilir. Tek bir fotoğrafın kadrajını ayarlamak için sayfa önizlemesinde fotoğrafa tıklayın. Gerçek genel görünüm, doku ve yüzey fotoğraflarınızı yükleyin; yakın çekim otomatik üretilmez.</p>${action("Sayfa önizlemesinde düzenle", "section", "sitePreview", "button secondary")}<p id="studio-photo-status" role="status"></p></section><iframe id="photo-preview-frame" title="Ortak ürün fotoğraf düzeni önizlemesi" class="studio-photo-preview" sandbox="allow-scripts allow-same-origin"></iframe>`;
  if (!siteScriptURL)
    siteScriptURL = URL.createObjectURL(
      new Blob([decodePreview(PREVIEW.js)], { type: "text/javascript" }),
    );
  const tag = "scr" + "ipt",
    config = {
      catalog: state,
      design: siteDesign,
      path: "/urunler",
      lang: "tr",
      assets: PREVIEW.assets,
      cart: [],
      inspect: false,
      heatmap: true,
    };
  $("#photo-preview-frame").srcdoc =
    '<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>' +
    decodePreview(PREVIEW.css) +
    '</style></head><body><div id="root"></div><' +
    tag +
    ">window.__KZ_SITE__=" +
    JSON.stringify(config).replaceAll("<", "\\u003c") +
    "</" +
    tag +
    "><" +
    tag +
    ' src="' +
    siteScriptURL +
    '"></' +
    tag +
    "></body></html>";
}
function photoFrameKey(binding) {
  if (!binding || binding.type !== "image") return null;
  if (binding.key.startsWith("image:")) return binding.key;
  if (binding.key.startsWith("product:")) {
    const image = state.product_images
      .filter((i) => i.product_id === binding.key.slice(8))
      .sort((a, b) => a.position - b.position)[0];
    return image ? "image:" + image.id : binding.key;
  }
  return null;
}
function photoFrameHTML(binding) {
  if (binding?.key?.startsWith("bestseller:"))
    return bestsellerFrameHTML(binding);
  const key = photoFrameKey(binding);
  if (!key) return "";
  const frame = siteDesign.photoFrames?.[key] || {
    scale: 100,
    x: 50,
    y: 50,
    role: "overview",
  };
  return `<div class="site-logo-scale" data-photo-frame-key="${esc(key)}"><p class="eyebrow">FOTOĞRAF KADRAJI</p><label>Ölçek · %<output id="site-photo-scale-value">${frame.scale}</output><input id="site-photo-frame-scale" aria-label="Fotoğraf ölçeği" type="range" min="50" max="160" value="${frame.scale}"></label><label>Yatay konum<input id="site-photo-frame-x" aria-label="Fotoğraf yatay konumu" type="range" min="0" max="100" value="${frame.x}"></label><label>Dikey konum<input id="site-photo-frame-y" aria-label="Fotoğraf dikey konumu" type="range" min="0" max="100" value="${frame.y}"></label><label>Çekim türü<select id="site-photo-frame-role" aria-label="Fotoğraf çekim türü">${studioPhotoOptions(
    [
      ["overview", "Genel görünüm"],
      ["texture", "Doku detayı"],
      ["finish", "Yüzey detayı"],
      ["installed", "Motosiklet üzerinde"],
      ["mounting", "Bağlantı noktaları"],
    ],
    frame.role,
  )}</select></label><p>Yüklediğiniz fotoğrafın gerçek içeriğine göre seçin. Ayarlar otomatik kaydedilir.</p></div>`;
}
function saveStudioDesign(next) {
  const design = validateDesign(next);
  localStorage.setItem(KEY + ".design", JSON.stringify(design));
  siteDesign = design;
  sendSiteConfig();
  $("#photo-preview-frame")?.contentWindow.postMessage(
    { type: "kz-site-config", catalog: state, design: siteDesign },
    "*",
  );
}
document.addEventListener("input", (event) => {
  const id = event.target.id;
  try {
    if (id === "studio-photo-scale") {
      saveStudioDesign({
        ...siteDesign,
        photography: {
          ...validateDesign(siteDesign).photography,
          scale: Number(event.target.value),
        },
      });
      $("#studio-photo-output").textContent = "%" + event.target.value;
    }
    if (id.startsWith("site-photo-frame-") && id !== "site-photo-frame-role") {
      const key = photoFrameKey(siteSelection?.binding),
        field = id.replace("site-photo-frame-", "");
      if (!key) return;
      const frame = siteDesign.photoFrames?.[key] || {
        scale: 100,
        x: 50,
        y: 50,
        role: "overview",
      };
      saveStudioDesign({
        ...siteDesign,
        photoFrames: {
          ...siteDesign.photoFrames,
          [key]: { ...frame, [field]: Number(event.target.value) },
        },
      });
      if (field === "scale")
        $("#site-photo-scale-value").textContent = event.target.value;
    }
  } catch (error) {
    toast(error.message);
  }
});
document.addEventListener("change", (event) => {
  const id = event.target.id;
  try {
    if (
      [
        "studio-photo-aspect",
        "studio-photo-background",
        "studio-photo-fit",
      ].includes(id)
    ) {
      const field = id.replace("studio-photo-", "");
      saveStudioDesign({
        ...siteDesign,
        photography: {
          ...validateDesign(siteDesign).photography,
          [field]: event.target.value,
        },
      });
    }
    if (id === "site-photo-frame-role") {
      const key = photoFrameKey(siteSelection?.binding),
        frame = siteDesign.photoFrames?.[key] || {
          scale: 100,
          x: 50,
          y: 50,
          role: "overview",
        };
      if (key)
        saveStudioDesign({
          ...siteDesign,
          photoFrames: {
            ...siteDesign.photoFrames,
            [key]: { ...frame, role: event.target.value },
          },
        });
    }
  } catch (error) {
    toast(error.message);
  }
});
document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const action = button.dataset.action;
  if (action === "studio-publish") void publishStudioVersion();
  if (action === "studio-restore") void publishStudioVersion(button.dataset.id);
  if (action === "site-release") goto("releases");
  if (["studio-draft", "studio-published", "site-published"].includes(action))
    window.open(
      studioCustomerURL(action === "studio-draft" ? "draft" : "published"),
      "_blank",
      "noopener",
    );
});
window.addEventListener("message", (event) => {
  const frame = $("#photo-preview-frame");
  if (
    frame &&
    event.source === frame.contentWindow &&
    event.data?.type === "kz-site-ready"
  )
    frame.contentWindow.postMessage(
      { type: "kz-site-config", catalog: state, design: siteDesign },
      "*",
    );
});

let siteBestsellerGuides = true;
function sendBestsellerGuides() {
  $("#site-frame")?.contentWindow.postMessage(
    { type: "kz-bestseller-guides", enabled: siteBestsellerGuides },
    "*",
  );
}
function bestsellerFrameHTML(binding) {
  const id = binding.key.slice(11),
    config = KZ_MODELS.readBestsellers(state),
    frame = config.frames[id] || { scale: 100, x: 50, y: 50, role: "overview" };
  sendBestsellerGuides();
  return `<div class="site-logo-scale"><p class="eyebrow">VİTRİN GÖRSELİ</p><label>Ölçek · %<output id="bestseller-scale-value">${frame.scale}</output><input id="bestseller-frame-scale" aria-label="Vitrin görsel ölçeği" type="range" min="50" max="200" value="${frame.scale}"></label><label>Yatay konum<input id="bestseller-frame-x" aria-label="Vitrin yatay konumu" type="range" min="0" max="100" value="${frame.x}"></label><label>Dikey konum<input id="bestseller-frame-y" aria-label="Vitrin dikey konumu" type="range" min="0" max="100" value="${frame.y}"></label><label><input id="bestseller-guides" type="checkbox" ${siteBestsellerGuides ? "checked" : ""}>Hizalama kılavuzu</label><button type="button" class="button secondary" data-action="bestseller-center-all">Hepsini ortala</button><p>Seçili ölçeği tüm vitrin görsellerine uygular ve ortalar. Ürün detayındaki fotoğraf kadrajı değişmez.</p></div>`;
}
function saveBestsellerConfig(config) {
  const next = KZ_MODELS.withBestsellers(state, config);
  validate(next);
  localStorage.setItem(KEY, JSON.stringify(next));
  state = next;
  sendSiteConfig();
}
document.addEventListener("input", (event) => {
  const field = event.target.id?.replace("bestseller-frame-", "");
  if (
    !["scale", "x", "y"].includes(field) ||
    !event.target.id.startsWith("bestseller-frame-")
  )
    return;
  const binding = siteSelection?.binding;
  if (!binding?.key?.startsWith("bestseller:")) return;
  try {
    const id = binding.key.slice(11),
      config = KZ_MODELS.readBestsellers(state),
      frame = config.frames[id] || {
        scale: 100,
        x: 50,
        y: 50,
        role: "overview",
      };
    saveBestsellerConfig({
      ...config,
      frames: {
        ...config.frames,
        [id]: { ...frame, [field]: Number(event.target.value) },
      },
    });
    if (field === "scale")
      $("#bestseller-scale-value").textContent = event.target.value;
    $("#site-direct-status").textContent = "✓ Vitrin kadrajı kaydedildi";
  } catch (error) {
    $("#site-direct-status").textContent = error.message;
  }
});
document.addEventListener("change", (event) => {
  if (event.target.id === "bestseller-guides") {
    siteBestsellerGuides = event.target.checked;
    sendBestsellerGuides();
  }
});
document.addEventListener("click", (event) => {
  if (!event.target.closest('[data-action="bestseller-center-all"]')) return;
  try {
    const id = siteSelection.binding.key.slice(11),
      config = KZ_MODELS.readBestsellers(state),
      scale = config.frames[id]?.scale || 100;
    saveBestsellerConfig({
      ...config,
      frames: Object.fromEntries(
        config.productIds.map((id) => [
          id,
          { scale, x: 50, y: 50, role: "overview" },
        ]),
      ),
    });
    paintSiteInspector();
    toast("Vitrin görselleri ortalandı.");
  } catch (error) {
    toast(error.message);
  }
});
