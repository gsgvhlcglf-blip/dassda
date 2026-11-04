"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { HeatPoint } from "@/lib/analytics";
export function AnalyticsHeatmapLayer({
  children,
  points = [],
  opacity = 0.7,
}: {
  children: ReactNode;
  points?: HeatPoint[];
  opacity?: number;
}) {
  const content = useRef<HTMLDivElement>(null),
    canvas = useRef<HTMLCanvasElement>(null),
    [size, setSize] = useState({ width: 1280, height: 900 });
  useEffect(() => {
    const element = content.current!;
    const update = () => {
      setSize({
        width: Math.max(innerWidth, element.scrollWidth),
        height: Math.max(innerHeight, element.offsetHeight),
      });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    window.addEventListener("resize", update);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);
  useEffect(() => {
    const node = canvas.current;
    if (!node) return;
    const ratio = Math.min(1, 1200 / size.width, 6000 / size.height);
    node.width = Math.max(1, Math.round(size.width * ratio));
    node.height = Math.max(1, Math.round(size.height * ratio));
    const ctx = node.getContext("2d", { willReadFrequently: true })!;
    ctx.clearRect(0, 0, node.width, node.height);
    if (!points.length) return;
    const max = Math.max(...points.map((p) => p.count));
    for (const point of points) {
      const x = point.x * node.width,
        y = point.y * node.height,
        radius = 32 * ratio,
        gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
      gradient.addColorStop(
        0,
        "rgba(0,0,0," +
          (0.35 + (0.55 * Math.log1p(point.count)) / Math.log1p(max)) +
          ")",
      );
      gradient.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = gradient;
      ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    }
    const density = ctx.getImageData(0, 0, node.width, node.height);
    const palette = document.createElement("canvas");
    palette.width = 256;
    palette.height = 1;
    const pc = palette.getContext("2d")!,
      g = pc.createLinearGradient(0, 0, 256, 0);
    for (const [at, color] of [
      [0, "#2457ed"],
      [0.25, "#1bd6ed"],
      [0.5, "#89e534"],
      [0.75, "#ffdf26"],
      [1, "#f12a1d"],
    ] as const)
      g.addColorStop(at, color);
    pc.fillStyle = g;
    pc.fillRect(0, 0, 256, 1);
    const colors = pc.getImageData(0, 0, 256, 1).data;
    for (let i = 0; i < density.data.length; i += 4) {
      const alpha = density.data[i + 3];
      if (!alpha) continue;
      density.data[i] = colors[alpha * 4];
      density.data[i + 1] = colors[alpha * 4 + 1];
      density.data[i + 2] = colors[alpha * 4 + 2];
      density.data[i + 3] = Math.min(220, alpha + 35);
    }
    ctx.putImageData(density, 0, 0);
  }, [points, size.width, size.height]);
  return (
    <div className="analytics-map-page">
      <div ref={content} inert>
        {children}
      </div>
      <canvas
        data-analytics-heatmap
        ref={canvas}
        aria-label="Tıklama yoğunluğu katmanı"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: size.width,
          height: size.height,
          opacity,
          pointerEvents: "none",
        }}
      />
    </div>
  );
}
export function HeatmapMessageLayer({ children }: { children: ReactNode }) {
  const [points, setPoints] = useState<HeatPoint[]>([]),
    [opacity, setOpacity] = useState(0.7);
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (
        event.source !== window.parent ||
        event.data?.type !== "kz-analytics-points"
      )
        return;
      if (!Array.isArray(event.data.points) || event.data.points.length > 4000)
        return;
      const valid = event.data.points.filter(
        (p: HeatPoint) =>
          Number.isFinite(p.x) &&
          p.x >= 0 &&
          p.x <= 1 &&
          Number.isFinite(p.y) &&
          p.y >= 0 &&
          p.y <= 1 &&
          Number.isFinite(p.count) &&
          p.count > 0,
      );
      setPoints(valid);
      if (Number.isFinite(event.data.opacity))
        setOpacity(Math.max(0.1, Math.min(1, event.data.opacity)));
    };
    window.addEventListener("message", receive);
    window.parent.postMessage({ type: "kz-analytics-map-ready" }, "*");
    return () => window.removeEventListener("message", receive);
  }, []);
  return (
    <AnalyticsHeatmapLayer points={points} opacity={opacity}>
      {children}
    </AnalyticsHeatmapLayer>
  );
}
