import {
  calculateLogoAlignment,
  type LogoMeasurement,
  type Rect,
} from "./logo-alignment";
import type {} from "./types";
const config = window.__KZ_SITE__;
let editing = config.inspect,
  enabled = config.logoGuides !== false,
  referenceKey: string | null = null;
let layer: HTMLDivElement | null = null,
  queued = false,
  generation = 0;
const alphaCache = new Map<string, Promise<Rect>>();
const rect = (value: DOMRect): Rect => ({
  x: value.x,
  y: value.y,
  width: value.width,
  height: value.height,
});
function union(rects: Rect[]): Rect {
  const x = Math.min(...rects.map((r) => r.x)),
    y = Math.min(...rects.map((r) => r.y));
  return {
    x,
    y,
    width: Math.max(...rects.map((r) => r.x + r.width)) - x,
    height: Math.max(...rects.map((r) => r.y + r.height)) - y,
  };
}
async function imageInk(image: HTMLImageElement): Promise<Rect> {
  const src = image.currentSrc || image.src;
  let cached = alphaCache.get(src);
  if (!cached) {
    cached = (async () => {
      await image.decode();
      const canvas = document.createElement("canvas"),
        ratio = Math.min(
          1,
          256 / Math.max(image.naturalWidth, image.naturalHeight),
        );
      canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
      const context = canvas.getContext("2d", { willReadFrequently: true })!;
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const pixels = context.getImageData(
        0,
        0,
        canvas.width,
        canvas.height,
      ).data;
      let left = canvas.width,
        top = canvas.height,
        right = -1,
        bottom = -1;
      for (let y = 0; y < canvas.height; y++)
        for (let x = 0; x < canvas.width; x++)
          if (pixels[(y * canvas.width + x) * 4 + 3] > 16) {
            left = Math.min(left, x);
            right = Math.max(right, x);
            top = Math.min(top, y);
            bottom = Math.max(bottom, y);
          }
      if (right < left)
        throw Error("Logo görseli tamamen şeffaf. Başka bir görsel seçin.");
      return {
        x: left / canvas.width,
        y: top / canvas.height,
        width: (right - left + 1) / canvas.width,
        height: (bottom - top + 1) / canvas.height,
      };
    })();
    if (alphaCache.size > 24) alphaCache.clear();
    alphaCache.set(src, cached);
    cached.catch(() => alphaCache.delete(src));
  }
  return cached;
}
function paintedRect(child: Element, effectiveScale: number): Rect {
  const box = child.getBoundingClientRect(),
    style = getComputedStyle(child);
  if (!style.clipPath.startsWith("polygon(")) return rect(box);
  const points = style.clipPath
    .slice(8, -1)
    .split(",")
    .map((pair) => pair.trim().split(/\s+/));
  if (
    points.some(
      (pair) =>
        pair.length !== 2 ||
        pair.some((value) => !/^[-\d.]+(%|px)?$/.test(value)),
    )
  )
    return rect(box);
  const element = child as HTMLElement,
    w = element.offsetWidth,
    h = element.offsetHeight,
    matrix = new DOMMatrixReadOnly(
      style.transform === "none" ? undefined : style.transform,
    );
  const bounds = points.map(([x, y]) => {
    const dx =
        (x.endsWith("%") ? (parseFloat(x) * w) / 100 : parseFloat(x)) - w / 2,
      dy =
        (y.endsWith("%") ? (parseFloat(y) * h) / 100 : parseFloat(y)) - h / 2;
    return {
      x:
        box.x +
        box.width / 2 +
        (matrix.a * dx + matrix.c * dy) * effectiveScale,
      y:
        box.y +
        box.height / 2 +
        (matrix.b * dx + matrix.d * dy) * effectiveScale,
      width: 0,
      height: 0,
    };
  });
  return union(bounds);
}
export async function measureBrandLogos(): Promise<LogoMeasurement[]> {
  const words = [
    ...document.querySelectorAll<HTMLElement>(
      '.brand-word[data-visual-image^="brand:"]',
    ),
  ];
  return Promise.all(
    words.map(async (word) => {
      const art = word.querySelector<HTMLElement>(".brand-logo-art")!,
        image = art.querySelector<HTMLImageElement>(".brand-logo-image"),
        key = word.dataset.visualImage!;
      const effectiveScale =
        art.getBoundingClientRect().width / art.offsetWidth;
      let bounds: Rect;
      if (image) {
        const ink = await imageInk(image),
          box = image.getBoundingClientRect(),
          ratio = Math.min(
            box.width / image.naturalWidth,
            box.height / image.naturalHeight,
          ),
          w = image.naturalWidth * ratio,
          h = image.naturalHeight * ratio;
        bounds = {
          x: box.x + (box.width - w) / 2 + ink.x * w,
          y: box.y + (box.height - h) / 2 + ink.y * h,
          width: ink.width * w,
          height: ink.height * h,
        };
      } else {
        const shapes = [...art.children]
          .map((child) => paintedRect(child, effectiveScale))
          .filter((r) => r.width > 0 && r.height > 0);
        if (!shapes.length) throw Error("Logo yüklenemedi.");
        bounds = union(shapes);
      }
      const offset = config.design?.logoOffsets?.[key] || { x: 0, y: 0 };
      return {
        key,
        bounds,
        slot: rect(word.getBoundingClientRect()),
        effectiveScale: art.getBoundingClientRect().width / art.offsetWidth,
        percent: config.design?.logoScales?.[key] ?? 100,
        offset,
      };
    }),
  );
}
function element(
  className: string,
  styles: Partial<CSSStyleDeclaration>,
  label?: string,
) {
  const el = document.createElement("div");
  el.className = className;
  Object.assign(el.style, styles);
  if (label) el.textContent = label;
  return el;
}
function position(box: Rect) {
  return {
    left: box.x + "px",
    top: box.y + "px",
    width: box.width + "px",
    height: box.height + "px",
  };
}
async function draw() {
  queued = false;
  const current = ++generation;
  if (!layer) return;
  if (!editing || !enabled || !referenceKey || config.standalone) {
    layer.hidden = true;
    return;
  }
  try {
    const logos = await measureBrandLogos(),
      reference = logos.find((l) => l.key === referenceKey),
      grid = document.querySelector(".brand-grid");
    if (!reference || !grid || current !== generation) {
      if (current === generation) layer.hidden = true;
      return;
    }
    const gridBox = grid.getBoundingClientRect();
    if (gridBox.bottom < 0 || gridBox.top > innerHeight) {
      layer.hidden = true;
      return;
    }
    const center = reference.slot.y + reference.slot.height / 2,
      height = reference.bounds.height;
    const fragment = document.createDocumentFragment();
    for (const [fraction, label] of [
      [-0.5, "Üst"],
      [0, "Orta"],
      [0.5, "Alt"],
    ] as const) {
      const line = element("kz-logo-line " + (fraction === 0 ? "center" : ""), {
        left: gridBox.x + "px",
        top: center + height * fraction + "px",
        width: gridBox.width + "px",
      });
      line.dataset.guide = label;
      fragment.append(line);
    }
    for (const logo of logos) {
      const ratio = height / logo.bounds.height,
        target = {
          x:
            logo.slot.x + logo.slot.width / 2 - (logo.bounds.width * ratio) / 2,
          y: center - height / 2,
          width: logo.bounds.width * ratio,
          height,
        };
      const ghost = element("kz-logo-ghost", position(target));
      ghost.dataset.logoKey = logo.key;
      fragment.append(ghost);
      fragment.append(
        element("kz-logo-axis", {
          left: logo.slot.x + logo.slot.width / 2 + "px",
          top: reference.slot.y + "px",
          height: reference.slot.height + "px",
        }),
      );
    }
    const selected = element("kz-logo-selected", position(reference.bounds));
    selected.dataset.logoKey = reference.key;
    fragment.append(selected);
    const toolbar = element("kz-logo-guide-toolbar", {
      left: gridBox.x + "px",
      top: Math.max(4, gridBox.top - 32) + "px",
      maxWidth: gridBox.width + "px",
    });
    const text = document.createElement("span");
    text.textContent = "Hizalama kılavuzu · " + Math.round(height) + " px";
    toolbar.append(text);
    const close = document.createElement("button");
    close.type = "button";
    close.setAttribute("aria-label", "Kılavuzları kapat");
    close.textContent = "×";
    close.addEventListener("click", () => {
      enabled = false;
      scheduleLogoGuides();
      window.parent.postMessage({ type: "kz-site-logo-guides-close" }, "*");
    });
    toolbar.append(close);
    fragment.append(toolbar);
    layer.replaceChildren(fragment);
    layer.hidden = false;
  } catch {
    if (current === generation) layer.hidden = true;
  }
}
export function scheduleLogoGuides() {
  if (!layer) return;
  if (!editing || !enabled || !referenceKey) {
    generation++;
    layer.hidden = true;
  }
  if (!queued) {
    queued = true;
    requestAnimationFrame(draw);
  }
}
export function selectLogoGuide(key: string | null) {
  referenceKey = key;
  scheduleLogoGuides();
}
export function setLogoGuideEditing(value: boolean) {
  editing = value;
  scheduleLogoGuides();
}
export function handleLogoGuideMessage(data: {
  type?: string;
  enabled?: boolean;
  referenceKey?: string;
  requestId?: string;
}) {
  if (config.standalone) return;
  if (data.type === "kz-site-logo-guides") {
    enabled = Boolean(data.enabled);
    scheduleLogoGuides();
  }
  if (
    data.type === "kz-site-logo-align" &&
    editing &&
    typeof data.referenceKey === "string"
  ) {
    const key = data.referenceKey,
      requestId = data.requestId;
    measureBrandLogos()
      .then((logos) => {
        const result = calculateLogoAlignment(logos, key);
        window.parent.postMessage(
          {
            type: "kz-site-logo-aligned",
            requestId,
            referenceKey: key,
            ...result,
          },
          "*",
        );
      })
      .catch((error) =>
        window.parent.postMessage(
          {
            type: "kz-site-logo-aligned",
            requestId,
            error:
              error instanceof Error ? error.message : "Logolar hizalanamadı.",
          },
          "*",
        ),
      );
  }
}
export function initializeLogoGuides() {
  if (config.standalone) return () => {};
  layer = document.createElement("div");
  layer.dataset.kzLogoGuides = "true";
  layer.hidden = true;
  layer.setAttribute("aria-label", "Logo hizalama kılavuzları");
  const style = document.createElement("style");
  style.textContent = `[data-kz-logo-guides]{position:fixed;inset:0;z-index:999998;pointer-events:none;overflow:hidden;font:10px/1.4 Arial,sans-serif;color:#cbe8ed}[data-kz-logo-guides][hidden]{display:none}.kz-logo-line{position:absolute;height:0;border-top:1px dashed #8ac9d3b3}.kz-logo-line.center{border-top-style:solid;border-color:#bce5ecaa}.kz-logo-ghost{position:absolute;border:1px dashed #94cbd570;background:#8ac9d307}.kz-logo-selected{position:absolute;border:1px solid #c7edf2a6}.kz-logo-axis{position:absolute;width:0;border-left:1px dashed #8ac9d36b}.kz-logo-guide-toolbar{position:absolute;display:flex;gap:14px;align-items:center;padding:4px 8px;background:#182e32ec;border:1px solid #557c83;pointer-events:auto;white-space:nowrap}.kz-logo-guide-toolbar button{font:16px/1 Arial;padding:0 3px;color:#e2f8fb;background:transparent;border:0;cursor:pointer}`;
  document.head.append(style);
  document.body.append(layer);
  const observer = new MutationObserver(scheduleLogoGuides),
    root = document.getElementById("root")!;
  observer.observe(root, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["style", "src", "class"],
  });
  const resize = new ResizeObserver(scheduleLogoGuides);
  resize.observe(root);
  window.addEventListener("scroll", scheduleLogoGuides, true);
  window.addEventListener("resize", scheduleLogoGuides);
  return () => {
    observer.disconnect();
    resize.disconnect();
    window.removeEventListener("scroll", scheduleLogoGuides, true);
    window.removeEventListener("resize", scheduleLogoGuides);
    layer?.remove();
    style.remove();
    layer = null;
  };
}
