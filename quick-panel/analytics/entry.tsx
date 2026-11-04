import { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  AnalyticsDashboard,
  type HeatmapSelection,
} from "../../src/components/analytics-dashboard";
import { previewAnalyticsSource } from "../../src/lib/analytics-preview";
import type { Catalog } from "../../src/lib/types";
type Configuration = {
  catalog: Catalog;
  design: unknown;
  assets: Record<string, string>;
  storageKey: string;
  revision: string;
  css: string;
  siteScriptURL: string;
  customerURL: string;
};
const config = (window as unknown as { __KZ_ANALYTICS__: Configuration })
  .__KZ_ANALYTICS__;
const json = (value: unknown) =>
  JSON.stringify(value).replaceAll("<", "\\u003c");
function PreviewHeatmapFrame({ selection }: { selection: HeatmapSelection }) {
  const frame = useRef<HTMLIFrameElement>(null),
    box = useRef<HTMLDivElement>(null);
  const [available, setAvailable] = useState(900);
  useEffect(() => {
    const observer = new ResizeObserver(() =>
      setAvailable(box.current?.clientWidth || 900),
    );
    if (box.current) observer.observe(box.current);
    return () => observer.disconnect();
  }, []);
  const srcDoc = useMemo(() => {
    let catalog = config.catalog,
      design = config.design;
    try {
      catalog =
        JSON.parse(localStorage.getItem(config.storageKey) || "null") ||
        catalog;
      design =
        JSON.parse(
          localStorage.getItem(config.storageKey + ".design") || "null",
        ) || design;
    } catch {
      /* Retain the current valid draft. */
    }
    const site = {
      catalog,
      design,
      path: selection.path,
      lang: "tr",
      assets: config.assets,
      cart: [],
      inspect: false,
      standalone: true,
      storageKey: config.storageKey,
      heatmap: true,
      revision: config.revision,
    };
    const tag = "scr" + "ipt";
    return (
      '<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>' +
      config.css +
      '</style></head><body><div id="root"></div><' +
      tag +
      ">window.__KZ_SITE__=" +
      json(site) +
      "</" +
      tag +
      "><" +
      tag +
      ' src="' +
      config.siteScriptURL +
      '"></' +
      tag +
      "></body></html>"
    );
  }, [selection.path]);
  const send = () =>
    frame.current?.contentWindow?.postMessage(
      {
        type: "kz-analytics-points",
        points: selection.points,
        opacity: selection.opacity,
      },
      "*",
    );
  useEffect(() => {
    send();
    const listener = (event: MessageEvent) => {
      if (
        event.source === frame.current?.contentWindow &&
        event.data?.type === "kz-analytics-map-ready"
      )
        send();
    };
    window.addEventListener("message", listener);
    return () => window.removeEventListener("message", listener);
  }, [selection]);
  const scale = Math.min(1, available / selection.width);
  return (
    <div ref={box} className="analytics-frame-box">
      <div
        style={{
          width: selection.width * scale,
          height: selection.height * scale,
          margin: "auto",
        }}
      >
        <iframe
          ref={frame}
          title="Test ısı haritası sayfa önizlemesi"
          srcDoc={srcDoc}
          sandbox="allow-scripts allow-same-origin"
          onLoad={send}
          style={{
            width: selection.width,
            height: selection.height,
            transform: "scale(" + scale + ")",
            transformOrigin: "top left",
            border: 0,
          }}
        />
      </div>
    </div>
  );
}
function App() {
  useEffect(() => {
    const resize = () =>
      window.parent.postMessage(
        {
          type: "kz-analytics-resize",
          height: Math.ceil(document.documentElement.scrollHeight),
        },
        "*",
      );
    const observer = new ResizeObserver(resize);
    observer.observe(document.body);
    resize();
    return () => observer.disconnect();
  }, []);
  return (
    <main className="analytics-standalone">
      <AnalyticsDashboard
        preview
        source={previewAnalyticsSource}
        onOpenCustomer={() =>
          window.open(config.customerURL, "_blank", "noopener")
        }
        renderFrame={(selection) => (
          <PreviewHeatmapFrame selection={selection} />
        )}
      />
    </main>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
