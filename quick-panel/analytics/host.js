let analyticsScriptURL;
function renderAnalyticsPreview(view) {
  view.innerHTML =
    '<iframe id="analytics-panel-frame" title="Analitik ve ısı haritası kontrol paneli" style="width:100%;height:1800px;border:0;background:#0b0b0b" sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-downloads allow-modals"></iframe>';
  if (!siteScriptURL)
    siteScriptURL = URL.createObjectURL(
      new Blob([decodePreview(PREVIEW.js)], { type: "text/javascript" }),
    );
  if (!analyticsScriptURL)
    analyticsScriptURL = URL.createObjectURL(
      new Blob([decodePreview(PREVIEW.analyticsJs)], {
        type: "text/javascript",
      }),
    );
  let customerURL = new URL("store.html", location.href).href;
  const source = location.search.slice(1);
  if (
    /^https:\/\/raw\.githubusercontent\.com\/gsgvhlcglf-blip\/dassda\/[^/]+\/docs\/panel\.html(?:\?|$)/.test(
      source,
    )
  )
    customerURL =
      "https://htmlpreview.github.io/?" +
      source.replace("/panel.html", "/store.html");
  const config = {
    catalog: state,
    design: siteDesign,
    assets: PREVIEW.assets,
    storageKey: KEY,
    revision: PREVIEW.version,
    css: decodePreview(PREVIEW.css),
    siteScriptURL,
    customerURL,
  };
  const tag = "scr" + "ipt";
  $("#analytics-panel-frame").srcdoc =
    '<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>' +
    config.css +
    '</style></head><body><div id="root"></div><' +
    tag +
    ">window.__KZ_ANALYTICS__=" +
    JSON.stringify(config).replaceAll("<", "\\u003c") +
    "</" +
    tag +
    "><" +
    tag +
    ' src="' +
    analyticsScriptURL +
    '"></' +
    tag +
    "></body></html>";
}
window.addEventListener("message", function (event) {
  const frame = $("#analytics-panel-frame");
  if (
    frame &&
    event.source === frame.contentWindow &&
    event.data?.type === "kz-analytics-resize" &&
    Number.isFinite(event.data.height)
  )
    frame.style.height =
      Math.min(12000, Math.max(900, event.data.height)) + "px";
});
