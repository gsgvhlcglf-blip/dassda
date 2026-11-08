"use client";
import { ProductPrice } from "./product-price";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, ArrowRight, Pause, Play } from "lucide-react";
import { ProductPhoto } from "./product-photo";
import { useVisualCopy, useVisualImage } from "@/lib/visual";
import { readBestsellers, centeredBestsellerFrame } from "@/lib/bestsellers";
import type { Catalog, Lang, Product } from "@/lib/types";
function BestsellerImage({
  product,
  catalog,
}: {
  product: Product;
  catalog: Catalog;
}) {
  const fallback = catalog.product_images
    .filter((i) => i.product_id === product.id)
    .sort((a, b) => a.position - b.position)[0]?.url;
  const src =
    useVisualImage("bestseller:" + product.id, fallback) ||
    "/images/part-0.svg";
  return (
    <Image
      src={src}
      alt={product.title.tr}
      fill
      sizes="(max-width: 760px) 80vw, 33vw"
      unoptimized
    />
  );
}
export function HomeBestsellers({
  catalog,
  lang,
}: {
  catalog: Catalog;
  lang: Lang;
}) {
  const config = readBestsellers(catalog),
    copy = useVisualCopy(lang),
    rail = useRef<HTMLDivElement>(null);
  const products = config.productIds
    .map((id) => catalog.products.find((p) => p.id === id && p.published))
    .filter((p): p is Product => !!p);
  const [paused, setPaused] = useState(false),
    [hovered, setHovered] = useState(false),
    [focused, setFocused] = useState(false),
    [editing, setEditing] = useState(false),
    [reduced, setReduced] = useState(false),
    [visible, setVisible] = useState(true),
    [index, setIndex] = useState(0);
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)"),
      update = () => setReduced(media.matches),
      edit = () =>
        setEditing(document.documentElement.dataset.kuzminEditing === "true"),
      observer = new MutationObserver(edit),
      visibility = () => setVisible(!document.hidden);
    update();
    edit();
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-kuzmin-editing"],
    });
    media.addEventListener("change", update);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      observer.disconnect();
      media.removeEventListener("change", update);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);
  function move(next: number) {
    const node = rail.current;
    if (!node) return;
    const card = node.querySelector<HTMLElement>(".bestseller-card");
    if (!card) return;
    const step =
        card.offsetWidth + parseFloat(getComputedStyle(node).gap || "0"),
      capacity = Math.max(1, Math.round(node.clientWidth / step)),
      maximum = Math.max(0, products.length - capacity),
      target = next > maximum ? 0 : next < 0 ? maximum : next;
    setIndex(target);
    node.scrollTo({
      left: target * step,
      behavior: reduced ? "instant" : "smooth",
    });
  }
  useEffect(() => {
    setIndex(0);
    rail.current?.scrollTo({ left: 0, behavior: "instant" });
  }, [config.productIds.join(",")]);
  useEffect(() => {
    if (
      products.length < 4 ||
      paused ||
      hovered ||
      focused ||
      editing ||
      reduced ||
      !visible
    )
      return;
    const timer = setInterval(
      () => move(index + 1),
      config.intervalSeconds * 1000,
    );
    return () => clearInterval(timer);
  }, [
    products.length,
    config.intervalSeconds,
    index,
    paused,
    hovered,
    focused,
    editing,
    reduced,
    visible,
  ]);
  if (!products.length) return null;
  return (
    <section
      className="home-bestsellers"
      aria-labelledby="bestsellers-title"
      aria-roledescription={products.length > 3 ? "karusel" : undefined}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setFocused(false);
      }}
    >
      <div className="bestsellers-heading">
        <h2
          id="bestsellers-title"
          data-visual-text="slot:home.bestsellers.title"
        >
          {copy("home.bestsellers.title", "En çok satanlar.")}
        </h2>
        {products.length > 3 && (
          <div
            className="bestsellers-controls"
            data-no-editor
            data-no-analytics
          >
            <button
              type="button"
              onClick={() => move(index - 1)}
              aria-label="Önceki ürünler"
            >
              <ArrowLeft size={17} />
            </button>
            <button
              type="button"
              onClick={() => setPaused((v) => !v)}
              aria-label={
                paused ? "Otomatik geçişi başlat" : "Otomatik geçişi durdur"
              }
            >
              {paused ? <Play size={15} /> : <Pause size={15} />}
            </button>
            <button
              type="button"
              onClick={() => move(index + 1)}
              aria-label="Sonraki ürünler"
            >
              <ArrowRight size={17} />
            </button>
          </div>
        )}
      </div>
      <div
        className="bestsellers-rail"
        ref={rail}
        onScroll={() => {
          const node = rail.current,
            card = node?.querySelector<HTMLElement>(".bestseller-card");
          if (node && card)
            setIndex(
              Math.round(
                node.scrollLeft /
                  (card.offsetWidth +
                    parseFloat(getComputedStyle(node).gap || "0")),
              ),
            );
        }}
      >
        {products.map((p) => (
          <Link
            className="bestseller-card"
            href={"/urunler/" + p.slug}
            key={p.id}
          >
            <ProductPhoto
              className="bestseller-visual"
              imageKey={"bestseller:" + p.id}
              frameOverride={config.frames[p.id] || centeredBestsellerFrame}
              settingsOverride={{
                aspect: "landscape",
                background: "dark",
                fit: "contain",
                scale: 100,
              }}
            >
              <span
                className="bestseller-image-binding"
                data-visual-image={"bestseller:" + p.id}
              >
                <BestsellerImage product={p} catalog={catalog} />
              </span>
              <span className="bestseller-guides" aria-hidden="true">
                <i />
                <i />
              </span>
              {p.demo && <span className="product-label">DEMO</span>}
            </ProductPhoto>
            <div className="bestseller-copy">
              <h3 data-edit-text={`products:${p.id}:title`}>{p.title[lang]}</h3>
              <ProductPrice product={p} lang={lang} />
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
