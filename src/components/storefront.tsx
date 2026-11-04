"use client";
import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type FormEvent,
} from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowUpRight,
  ArrowRight,
  ArrowLeft,
  ChevronRight,
  Plus,
  Minus,
  ShoppingBag,
  Menu,
  X,
  Check,
  Search,
  SlidersHorizontal,
  MoveDown,
} from "lucide-react";
import type { Catalog, Product, CartLine, Lang } from "@/lib/types";
import { money, type MessageKey } from "@/lib/i18n";
import {
  useVisualTranslate,
  useVisualImage,
  useVisualCopy,
  useVisualLogoScale,
  useVisualLogoOffset,
} from "@/lib/visual";
import { useCart } from "@/lib/cart-store";
import {
  CustomerPage,
  MemberGate,
  TrackingPage,
  BlogPage,
  type CustomerView,
} from "./customer-pages";
import { resolveStoreLanguage } from "@/lib/settings";
import { compatibleProducts } from "@/lib/commerce";
function Art({
  src,
  alt,
  priority = false,
  className = "",
  visualId,
}: {
  visualId?: string;
  src: string | undefined;
  alt: string;
  priority?: boolean;
  className?: string;
}) {
  const resolved = useVisualImage(visualId, src);
  return (
    <Image
      data-visual-image={visualId}
      src={resolved || "/images/model.svg"}
      alt={alt}
      fill
      sizes="(max-width: 700px) 100vw, 60vw"
      priority={priority}
      unoptimized={src?.startsWith("/uploads/") || src?.startsWith("https:")}
      className={className}
    />
  );
}
function BrandVisual({
  id,
  name,
  children,
}: {
  id: string;
  name: string;
  children: React.ReactNode;
}) {
  const image = useVisualImage(`brand:${id}`, undefined);
  const scale = useVisualLogoScale(`brand:${id}`);
  const offset = useVisualLogoOffset(`brand:${id}`);
  return (
    <div
      className="brand-logo-art"
      style={
        {
          "--brand-scale": scale,
          "--logo-x": offset.x + "px",
          "--logo-y": offset.y + "px",
        } as CSSProperties
      }
    >
      {image ? (
        <img className="brand-logo-image" src={image} alt={name} />
      ) : (
        children
      )}
    </div>
  );
}
export function Storefront({
  catalog: c,
  segments: s,
  lang: requestedLang,
  live,
  preview = false,
  previewQuery,
  onNavigate,
  customer = null,
}: {
  customer?: CustomerView | null;
  preview?: boolean;
  previewQuery?: string;
  onNavigate?: (url: string) => void;
  catalog: Catalog;
  segments: string[];
  lang: Lang;
  live: boolean;
}) {
  const lang = resolveStoreLanguage(requestedLang);
  const copy = useVisualCopy(lang);
  const t = useVisualTranslate(lang),
    href = (path: string) => {
      const [pathname, search] = path.split("?");
      const query = new URLSearchParams(search || "");
      if (lang === "tr") query.delete("lang");
      else query.set("lang", lang);
      return pathname + (query.size ? "?" + query.toString() : "");
    };
  const [cart, setCart] = useCart();
  const [previewMember, setPreviewMember] = useState<CustomerView | null>(null);
  const member = preview ? previewMember : customer;
  useEffect(() => {
    if (preview && sessionStorage.getItem("kz-preview-member") === "true")
      setPreviewMember({ id: "preview-member", email: "" });
  }, [preview]);
  function togglePreviewMember() {
    const enabled = !previewMember;
    sessionStorage.setItem("kz-preview-member", String(enabled));
    setPreviewMember(enabled ? { id: "preview-member", email: "" } : null);
  }

  const [menu, setMenu] = useState(false),
    [toast, setToast] = useState(""),
    [savedBike, setSavedBike] = useState("");
  useEffect(() => {
    document.documentElement.lang = lang;
    if (!preview) setSavedBike(localStorage.getItem("kz-bike") || "");
  }, [lang, preview]);
  useEffect(() => {
    if (s[0] === "motosikletler" && s[3]) {
      const path = "/" + s.join("/");
      if (!preview) localStorage.setItem("kz-bike", path);
      setSavedBike(path);
    }
  }, [s, preview]);
  useEffect(() => {
    if (toast) {
      const tm = setTimeout(() => setToast(""), 3500);
      return () => clearTimeout(tm);
    }
  }, [toast]);
  const add = (p: Product, variantId: string, quantity: number) => {
    const v = c.variants.find(
      (v) => v.id === variantId && v.product_id === p.id,
    );
    if (!v) return;
    const existing = cart.find((l) => l.variantId === variantId)?.quantity || 0;
    const productQuantity = cart
      .filter((l) => l.productId === p.id)
      .reduce((a, l) => a + l.quantity, 0);
    if (existing + quantity > v.stock || productQuantity + quantity > p.stock) {
      setToast(t("stockError"));
      return;
    }
    setCart((old) => {
      const found = old.find((l) => l.variantId === variantId);
      return found
        ? old.map((l) =>
            l.variantId === variantId
              ? { ...l, quantity: l.quantity + quantity }
              : l,
          )
        : [...old, { productId: p.id, variantId, quantity }];
    });
    setToast(t("added"));
  };
  const update = (id: string, n: number) =>
    setCart((old) =>
      n <= 0
        ? old.filter((l) => l.variantId !== id)
        : old.map((l) =>
            l.variantId === id
              ? {
                  ...l,
                  quantity: Math.min(
                    n,
                    c.variants.find((v) => v.id === id)?.stock || 0,
                    99,
                  ),
                }
              : l,
          ),
    );
  const productCard = (p: Product) => (
    <Link className="product-card" href={href(`/urunler/${p.slug}`)} key={p.id}>
      <div className="product-visual">
        <Art
          src={
            c.product_images
              .filter((i) => i.product_id === p.id)
              .sort((a, b) => a.position - b.position)[0]?.url
          }
          alt={p.title[lang]}
          visualId={`product:${p.id}`}
        />
        <span className="product-label">
          {p.demo ? "DEMO" : p.stock > 0 ? t("available") : t("outStock")}
        </span>
        <span className="product-open">
          <ArrowUpRight size={20} />
        </span>
      </div>
      <div className="product-heading">
        <h3 data-edit-text={`products:${p.id}:title`}>{p.title[lang]}</h3>
        <span data-edit-text={`products:${p.id}:price`}>
          {money(p.price, lang)}
        </span>
      </div>
      <p className="micro muted">
        {t(p.material as MessageKey)} <span> / </span>{" "}
        {p.stock > 0 ? (p.demo ? t("inStock") : t("available")) : t("outStock")}
      </p>
    </Link>
  );
  const brandCards = () => (
    <div className="brand-grid">
      {c.brands
        .sort((a, b) => a.position - b.position)
        .map((b, i) => (
          <Link
            className="brand-card"
            href={href(`/motosikletler/${b.slug}`)}
            key={b.id}
          >
            <span className="brand-index">0{i + 1}</span>
            <div
              className={`brand-word ${b.slug}`}
              data-visual-image={`brand:${b.id}`}
            >
              <BrandVisual id={b.id} name={b.name}>
                {b.name === "BMW" ? (
                  <>
                    <div className="bmw-ring">
                      <span>BMW</span>
                      <div className="bmw-check" />
                    </div>
                  </>
                ) : b.name === "DUCATI" ? (
                  <div className="ducati-shield">
                    <b>DUCATI</b>
                    <span />
                  </div>
                ) : (
                  <>
                    <div className="yamaha-icon">✳</div>
                    <b>YAMAHA</b>
                  </>
                )}
              </BrandVisual>
            </div>
            <span className="brand-discover">
              {b.name} · {t("discover")} <ArrowUpRight size={14} />
            </span>
          </Link>
        ))}
    </div>
  );
  const crumbs = (parts: { label: string; url?: string }[]) => (
    <nav className="breadcrumbs" aria-label="Breadcrumb">
      <Link href={href("/motosikletler")}>{t("motorcycles")}</Link>
      {parts.map((p, i) => (
        <span key={i}>
          <ChevronRight size={12} />
          {p.url ? <Link href={href(p.url)}>{p.label}</Link> : p.label}
        </span>
      ))}
    </nav>
  );
  const renderMotorcycles = () => {
    const b = c.brands.find((b) => b.slug === s[1]),
      m = c.models.find((m) => m.slug === s[2] && m.brand_id === b?.id);
    if (!b)
      return (
        <section className="page-section brand-page">
          <p className="eyebrow">{t("selectBike")}</p>
          <h1>{t("chooseBrand")}</h1>
          <p className="intro">{t("brandIntro")}</p>
          {brandCards()}
        </section>
      );
    if (!m)
      return (
        <section className="page-section">
          {crumbs([{ label: b.name }])}
          <div className="title-row">
            <div>
              <p className="eyebrow">{b.name} / 01</p>
              <h1>{t("chooseModel")}</h1>
            </div>
            <Link className="text-link" href={href("/motosikletler")}>
              <ArrowLeft size={14} />
              {t("back")}
            </Link>
          </div>
          <div className="model-grid">
            {c.models
              .filter((m) => m.brand_id === b.id)
              .map((m, i) => (
                <Link
                  className="model-card"
                  key={m.id}
                  href={href(`/motosikletler/${b.slug}/${m.slug}`)}
                >
                  <div className="model-art">
                    <Art
                      visualId={`model:${m.id}`}
                      src={m.image}
                      alt={`${b.name} ${m.name} — ${t("imageLabel")}`}
                    />
                    <span className="micro">{t("imageLabel")}</span>
                  </div>
                  <div className="model-heading">
                    <span className="micro muted">
                      0{i + 1} / {b.name}
                    </span>
                    <h2 data-edit-text={`models:${m.id}:name`}>{m.name}</h2>
                    <ArrowUpRight />
                  </div>
                </Link>
              ))}
          </div>
          {!c.models.some((m) => m.brand_id === b.id) && (
            <p className="empty">{t("noModels")}</p>
          )}
        </section>
      );
    if (!s[3])
      return (
        <section className="page-section year-page">
          {crumbs([
            { label: b.name, url: `/motosikletler/${b.slug}` },
            { label: m.name },
          ])}
          <div className="year-layout">
            <div>
              <p className="eyebrow">
                {b.name} / {m.name} / 02
              </p>
              <h1>{t("chooseYear")}</h1>
              <p className="intro">{t("yearIntro")}</p>
              <div className="years">
                {c.model_years
                  .filter((y) => y.model_id === m.id)
                  .sort((a, b) => b.year - a.year)
                  .map((y) => (
                    <Link
                      href={href(
                        `/motosikletler/${b.slug}/${m.slug}/${y.year}`,
                      )}
                      key={y.id}
                    >
                      {y.year}
                      <ArrowUpRight size={16} />
                    </Link>
                  ))}
              </div>
              {!c.model_years.some((y) => y.model_id === m.id) && (
                <p>{t("noYears")}</p>
              )}
              <Link
                href={href(`/motosikletler/${b.slug}`)}
                className="text-link"
              >
                <ArrowLeft size={14} />
                {t("back")}
              </Link>
            </div>
            <div className="year-image">
              <Art src={m.image} alt={m.name} visualId={`model:${m.id}`} />
              <span className="micro muted">{t("imageLabel")}</span>
            </div>
          </div>
        </section>
      );
    return (
      <section className="page-section">
        {crumbs([
          { label: b.name, url: `/motosikletler/${b.slug}` },
          { label: m.name, url: `/motosikletler/${b.slug}/${m.slug}` },
          { label: s[3] },
        ])}
        <p className="eyebrow">
          {b.name} / {m.name} / {s[3]}
        </p>
        <h1>{t("compatible")}</h1>
        <div className="selection-strip">
          <span>
            <Check size={14} />
            {b.name} {m.name} · {s[3]}
          </span>
          <Link
            className="text-link"
            href={href(`/motosikletler/${b.slug}/${m.slug}`)}
          >
            {t("changeBike")}
            <ArrowUpRight size={14} />
          </Link>
        </div>
        <ProductListing
          products={compatibleProducts(c, m.id, Number(s[3]))}
          c={c}
          lang={lang}
          card={productCard}
        />
      </section>
    );
  };
  const renderProduct = () => {
    const p = c.products.find((p) => p.slug === s[1])!;
    return (
      <ProductDetail key={p.id} p={p} c={c} lang={lang} href={href} add={add} />
    );
  };
  const cartItems = cart.map((l) => ({
    ...l,
    p: c.products.find((p) => p.id === l.productId),
    v: c.variants.find((v) => v.id === l.variantId),
  }));
  const total = cartItems.reduce(
    (sum, l) => sum + (l.v?.price || 0) * l.quantity,
    0,
  );
  const cartPage = () => (
    <section className="page-section">
      <p className="eyebrow">KUZMIN / {t("cart")}</p>
      <h1>{t("yourBag")}</h1>
      {!cart.length ? (
        <div className="empty-state">
          <ShoppingBag size={36} strokeWidth={1} />
          <h2>{t("emptyBag")}</h2>
          <Link className="button" href={href("/urunler")}>
            {t("continue")}
            <ArrowUpRight size={16} />
          </Link>
        </div>
      ) : (
        <div className="cart-layout">
          <div>
            {cartItems.map((l) => (
              <div className="cart-line" key={l.variantId}>
                <div className="cart-image">
                  <Art
                    src={
                      c.product_images.find((i) => i.product_id === l.productId)
                        ?.url
                    }
                    alt={l.p?.title[lang] || ""}
                  />
                </div>
                <div className="cart-info">
                  <Link href={href(`/urunler/${l.p?.slug || ""}`)}>
                    <h3>{l.p?.title[lang] || t("notProvided")}</h3>
                  </Link>
                  <p className="muted micro">
                    {l.v?.name[lang]} / {l.v?.sku}
                  </p>
                  <button
                    className="under-link"
                    onClick={() => update(l.variantId, 0)}
                  >
                    {t("remove")}
                  </button>
                </div>
                <div className="cart-controls">
                  <span>{money((l.v?.price || 0) * l.quantity, lang)}</span>
                  <div className="quantity">
                    <button
                      aria-label={t("quantity") + " −"}
                      onClick={() => update(l.variantId, l.quantity - 1)}
                    >
                      <Minus size={14} />
                    </button>
                    <span>{l.quantity}</span>
                    <button
                      disabled={l.quantity >= (l.v?.stock || 0)}
                      aria-label={t("quantity") + " +"}
                      onClick={() => update(l.variantId, l.quantity + 1)}
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <aside className="order-summary">
            <p className="eyebrow">{t("cart")}</p>
            <div className="summary-total">
              <span>{t("subtotal")}</span>
              <strong>{money(total, lang)}</strong>
            </div>
            <p className="muted">{t("shippingNote")}</p>
            <Link
              className="button wide"
              href={href(member ? "/odeme" : "/giris?next=%2Fodeme")}
            >
              {t("checkout")}
              <ArrowUpRight size={16} />
            </Link>
            <p className="micro muted">{t("orderNote")}</p>
          </aside>
        </div>
      )}
    </section>
  );
  const renderContent = () => {
    const key: Record<string, string> = {
      hakkimizda: "about",
      iletisim: "contact",
      sss: "faq",
      "teslimat-iade": "shipping",
      gizlilik: "privacy",
      kosullar: "terms",
    };
    const row = c.content.find((r) => r.key === key[s[0]]);
    return (
      <section className="page-section prose-page">
        <p className="eyebrow">KUZMIN / {key[s[0]]}</p>
        <h1 data-edit-text={row && `content:${row.id}:title`}>
          {row?.title[lang] || t("notProvided")}
        </h1>
        <div
          className="content-body"
          data-edit-text={row && `content:${row.id}:body`}
        >
          {row?.body[lang]?.split("\n").map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
        <Link className="text-link" href={href("/motosikletler")}>
          {t("explore")}
          <ArrowUpRight size={16} />
        </Link>
      </section>
    );
  };
  const home = c.content.find((r) => r.key === "home");
  return (
    <>
      <a className="skip-link" href="#main">
        {lang === "tr"
          ? "İçeriğe geç"
          : lang === "en"
            ? "Skip to content"
            : "К содержимому"}
      </a>
      <header className="site-header">
        <Link
          className="wordmark header-wordmark"
          href={href("/")}
          aria-label="KUZMIN"
        >
          <b data-visual-text="slot:header.brand">
            {copy("header.brand", "KUZMIN")}
          </b>
          <span data-visual-text="slot:header.tagline">
            {copy("header.tagline", "CARBON MOTORCYCLE PARTS")}
          </span>
        </Link>
        <nav
          className={menu ? "primary-nav open" : "primary-nav"}
          aria-label={t("menu")}
        >
          {(
            [
              ["/", "home"],
              ["/motosikletler", "motorcycles"],
              ["/hakkimizda", "about"],
              ["/blog", "blog"],
              ["/iletisim", "contact"],
            ] as [string, MessageKey][]
          ).map(([url, label]) => (
            <Link
              key={url}
              href={href(url)}
              className={"/" + s.join("/") === url ? "active" : ""}
              onClick={() => setMenu(false)}
            >
              {t(label)}
            </Link>
          ))}
        </nav>
        <div className="nav-actions">
          <div className="member-links">
            <Link href={href(member ? "/hesabim" : "/giris")}>
              {t("account")}
            </Link>
          </div>
          <Link
            className="bag-link"
            href={href("/sepet")}
            aria-label={`${t("cart")} (${cart.reduce((a, l) => a + l.quantity, 0)})`}
          >
            <ShoppingBag size={19} strokeWidth={1.4} />
            <span>{cart.reduce((a, l) => a + l.quantity, 0)}</span>
          </Link>
          <button
            className="menu-toggle"
            aria-label={menu ? t("close") : t("menu")}
            aria-expanded={menu}
            onClick={() => setMenu(!menu)}
          >
            {menu ? <X size={21} /> : <Menu size={21} />}
          </button>
        </div>
      </header>
      <main id="main">
        {!s.length ? (
          <>
            <section className="hero">
              <Art
                src="/images/hero.webp"
                alt={t("imageLabel")}
                priority
                visualId="home.hero"
              />
              <div className="hero-shade" />
              <div className="hero-content">
                <p className="eyebrow">{t("eyebrow")}</p>
                <h1 data-edit-text={home && `content:${home.id}:title`}>
                  {home?.title[lang] || "Detayda fark yarat."}
                </h1>
                <p data-edit-text={home && `content:${home.id}:body`}>
                  {home?.body[lang]}
                </p>
                <Link className="button" href={href("/motosikletler")}>
                  {t("explore")}
                  <ArrowUpRight size={16} />
                </Link>
              </div>
              <div className="hero-bottom">
                <span className="micro" data-visual-text="slot:hero.collection">
                  {copy("hero.collection", "01 — CARBON COLLECTION")}
                </span>
                <a href="#collection" className="scroll-link">
                  {t("scroll")}
                  <MoveDown size={16} />
                </a>
                <span className="micro hero-art-label">{t("imageLabel")}</span>
              </div>
              <span className="hero-side" data-visual-text="slot:hero.side">
                {copy("hero.side", "DESIGNED TO MAKE A DIFFERENCE")}
              </span>
            </section>
            <section id="collection" className="section editorial-section">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">01 / {t("catalog")}</p>
                  <h2>{t("collectionTitle")}</h2>
                </div>
                <Link className="text-link" href={href("/urunler")}>
                  {t("viewAll")}
                  <ArrowUpRight size={16} />
                </Link>
              </div>
              <div className="editorial-grid">
                <Link
                  href={href("/urunler?category=body")}
                  className="editorial-card"
                >
                  <div className="editorial-image carbon-photo">
                    <Art
                      src="/images/carbon.svg"
                      alt={t("imageLabel")}
                      visualId="home.collection.body"
                    />
                    <span className="editorial-number">01</span>
                    <ArrowUpRight className="editorial-arrow" />
                  </div>
                  <div className="editorial-caption">
                    <h3>{t("performance")}</h3>
                    <span className="micro">
                      {t("shopBody")} <ArrowRight size={13} />
                    </span>
                  </div>
                </Link>
                <Link
                  href={href("/urunler?category=details")}
                  className="editorial-card"
                >
                  <div className="editorial-image bike-detail">
                    <Art
                      src="/images/hero.webp"
                      alt={t("imageLabel")}
                      visualId="home.collection.details"
                    />
                    <span className="editorial-number">02</span>
                    <ArrowUpRight className="editorial-arrow" />
                  </div>
                  <div className="editorial-caption">
                    <h3>{t("expression")}</h3>
                    <span className="micro">
                      {t("shopDetails")} <ArrowRight size={13} />
                    </span>
                  </div>
                </Link>
              </div>
            </section>
            <section className="section bike-section">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">02 / {t("motorcycles")}</p>
                  <h2>{t("chooseBrand")}</h2>
                </div>
                <p className="muted">{t("brandIntro")}</p>
              </div>
              {brandCards()}
            </section>
            <section className="section featured-section">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">03 / {t("featured")}</p>
                  <h2>{t("featured")}.</h2>
                </div>
                <Link className="text-link" href={href("/urunler")}>
                  {t("viewCollection")}
                  <ArrowUpRight size={16} />
                </Link>
              </div>
              <div className="product-grid">
                {c.products
                  .filter((p) => p.featured && p.published)
                  .slice(0, 4)
                  .map(productCard)}
              </div>
            </section>
            <section className="craft-section">
              <div className="craft-image">
                <Art
                  src="/images/carbon.svg"
                  alt={t("imageLabel")}
                  visualId="home.craft"
                />
                <span className="micro" data-visual-text="slot:craft.caption">
                  {copy("craft.caption", "THE LANGUAGE OF CARBON")}
                </span>
              </div>
              <div className="craft-copy">
                <p className="eyebrow">04 / KUZMIN</p>
                <h2>{t("crafted")}</h2>
                <p className="muted">{t("craftBody")}</p>
                <Link className="text-link" href={href("/hakkimizda")}>
                  {t("ourStory")}
                  <ArrowUpRight size={15} />
                </Link>
              </div>
            </section>
          </>
        ) : s[0] === "motosikletler" ? (
          renderMotorcycles()
        ) : s[0] === "urunler" ? (
          s[1] ? (
            renderProduct()
          ) : (
            <section className="page-section">
              <p className="eyebrow">KUZMIN / {t("catalog")}</p>
              <h1>{t("allProducts")}</h1>
              {savedBike && (
                <Link className="selection-strip" href={href(savedBike)}>
                  <span>
                    {t("savedBike")}:{" "}
                    {savedBike.split("/").slice(2).join(" · ").toUpperCase()}
                  </span>
                  <ArrowRight size={16} />
                </Link>
              )}
              <ProductListing
                c={c}
                products={c.products.filter((p) => p.published)}
                lang={lang}
                card={productCard}
                queryString={preview ? previewQuery : undefined}
              />
            </section>
          )
        ) : s[0] === "sepet" ? (
          cartPage()
        ) : ["giris", "uye-ol", "hesabim"].includes(s[0]) ? (
          <CustomerPage
            lang={lang}
            href={href}
            mode={
              s[0] === "uye-ol"
                ? "signup"
                : s[0] === "giris"
                  ? "login"
                  : "account"
            }
            preview={preview}
            live={live}
            user={member}
            onDemo={togglePreviewMember}
            onNavigate={onNavigate}
            query={previewQuery}
          />
        ) : s[0] === "blog" ? (
          <BlogPage c={c} lang={lang} href={href} slug={s[1]} />
        ) : s[0] === "kargo-takip" ? (
          <TrackingPage c={c} lang={lang} />
        ) : s[0] === "odeme" ? (
          member ? (
            <Checkout
              lang={lang}
              cart={cart}
              total={total}
              href={href}
              clear={() => setCart([])}
              preview={preview}
            />
          ) : (
            <MemberGate lang={lang} href={href} />
          )
        ) : (
          renderContent()
        )}
      </main>
      <footer>
        <div className="footer-top">
          <div>
            <p className="eyebrow">{t("talkEye")}</p>
            <Link href={href("/iletisim")} className="footer-title">
              {t("talk")}
              <ArrowUpRight size={34} strokeWidth={1} />
            </Link>
          </div>
          <Link className="wordmark" href={href("/")}>
            KUZMIN<span>CARBON MOTORCYCLE PARTS</span>
          </Link>
        </div>
        <div className="footer-nav">
          <div>
            {(
              [
                ["/sss", "faq"],
                ["/teslimat-iade", "shipping"],
                ["/gizlilik", "privacy"],
                ["/kosullar", "terms"],
                ["/kargo-takip", "tracking"],
                ["/admin", "admin"],
              ] as [string, MessageKey][]
            ).map(([url, k]) => (
              <Link key={url} href={href(url)}>
                {t(k)}
              </Link>
            ))}
          </div>
        </div>
        <div className="footer-bottom">
          <p>
            © {new Date().getFullYear()} KUZMIN. {t("independent")}
          </p>
          <span className="demo-indicator">
            {!live ? "LOCAL DEMO" : "ORDER REQUESTS"}
          </span>
        </div>
        <p className="demo-notice">
          {!live || c.products.some((p) => p.demo) ? t("demo") : t("orderNote")}
        </p>
      </footer>
      {toast && (
        <div role="status" className="toast">
          <Check size={16} />
          {toast}
          <Link href={href("/sepet")}>
            {t("cart")}
            <ArrowRight size={14} />
          </Link>
        </div>
      )}
    </>
  );
}
function ProductListing({
  products,
  c,
  lang,
  card,
  queryString,
}: {
  queryString?: string;
  products: Product[];
  c: Catalog;
  lang: Lang;
  card: (p: Product) => React.ReactNode;
}) {
  const t = useVisualTranslate(lang);
  const [search, setSearch] = useState(""),
    [category, setCategory] = useState(""),
    [material, setMaterial] = useState(""),
    [sort, setSort] = useState("recommended"),
    [stock, setStock] = useState(false);
  useEffect(() => {
    setCategory(
      new URLSearchParams(queryString ?? window.location.search).get(
        "category",
      ) || "",
    );
  }, []);
  const list = useMemo(
    () =>
      products
        .filter(
          (p) =>
            (!category || p.category_id === category) &&
            (!material || p.material === material) &&
            (!stock || p.stock > 0) &&
            `${p.title[lang]} ${p.sku}`
              .toLowerCase()
              .includes(search.toLowerCase()),
        )
        .sort((a, b) =>
          sort === "asc"
            ? a.price - b.price
            : sort === "desc"
              ? b.price - a.price
              : Number(b.featured) - Number(a.featured),
        ),
    [products, category, material, stock, search, lang, sort],
  );
  return (
    <>
      <div className="catalog-tools">
        <div className="search-field">
          <Search size={17} />
          <input
            aria-label={t("search")}
            placeholder={t("search")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="filter-select">
          <SlidersHorizontal size={14} />
          <select
            aria-label={t("catalog")}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">
              {t("all")} / {t("catalog")}
            </option>
            {c.categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name[lang]}
              </option>
            ))}
          </select>
        </div>
        <select
          aria-label={t("material")}
          value={material}
          onChange={(e) => setMaterial(e.target.value)}
        >
          <option value="">
            {t("all")} / {t("material")}
          </option>
          {["full_carbon", "hybrid", "forged", "carbon_finish"].map((m) => (
            <option key={m} value={m}>
              {t(m as MessageKey)}
            </option>
          ))}
        </select>
        <select
          aria-label={t("sort")}
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          <option value="recommended">{t("newest")}</option>
          <option value="asc">{t("priceAsc")}</option>
          <option value="desc">{t("priceDesc")}</option>
        </select>
      </div>
      <div className="result-row">
        <span>
          {String(list.length).padStart(2, "0")} {t("products")}
        </span>
        <label>
          <input
            type="checkbox"
            checked={stock}
            onChange={(e) => setStock(e.target.checked)}
          />
          {t("availability")}
        </label>
      </div>
      {list.length ? (
        <div className="product-grid catalog-grid">{list.map(card)}</div>
      ) : (
        <div className="empty-state">
          <h2>{t("empty")}</h2>
          <button
            className="text-link"
            onClick={() => {
              setSearch("");
              setMaterial("");
              setCategory("");
              setStock(false);
            }}
          >
            {t("reset")}
            <ArrowRight size={16} />
          </button>
        </div>
      )}
    </>
  );
}
function ProductDetail({
  p,
  c,
  lang,
  href,
  add,
}: {
  p: Product;
  c: Catalog;
  lang: Lang;
  href: (p: string) => string;
  add: (p: Product, v: string, q: number) => void;
}) {
  const t = useVisualTranslate(lang),
    variants = c.variants.filter((v) => v.product_id === p.id),
    images = c.product_images
      .filter((i) => i.product_id === p.id)
      .sort((a, b) => a.position - b.position);
  const [variant, setVariant] = useState(variants[0]?.id || ""),
    [quantity, setQuantity] = useState(1),
    [image, setImage] = useState(0),
    [tab, setTab] = useState("specs");
  const v = variants.find((v) => v.id === variant),
    max = Math.min(p.stock, v?.stock || 0);
  return (
    <section className="page-section product-page">
      <nav className="breadcrumbs">
        <Link href={href("/urunler")}>{t("catalog")}</Link>
        <ChevronRight size={12} />
        <span>{p.title[lang]}</span>
      </nav>
      <div className="product-detail">
        <div>
          <div className="detail-main-image">
            <Art
              src={images[image]?.url || "/images/part-0.svg"}
              alt={images[image]?.alt[lang] || p.title[lang]}
              visualId={
                images[image] ? `image:${images[image].id}` : `product:${p.id}`
              }
            />
            <span className="product-label">{p.demo ? "DEMO" : p.sku}</span>
          </div>
          <div className="thumbnails">
            {images.map((img, i) => (
              <button
                aria-label={img.alt[lang] + ` ${i + 1}`}
                className={image === i ? "selected" : ""}
                key={img.id}
                onClick={() => setImage(i)}
              >
                <Art
                  src={img.url}
                  alt={img.alt[lang]}
                  visualId={`image:${img.id}`}
                />
              </button>
            ))}
          </div>
        </div>
        <div className="product-copy">
          <p className="eyebrow">
            {t(p.material as MessageKey)} / {p.sku}
          </p>
          <h1 data-edit-text={`products:${p.id}:title`}>{p.title[lang]}</h1>
          <div className="detail-price">
            <span
              data-edit-text={
                v ? `variants:${v.id}:price` : `products:${p.id}:price`
              }
            >
              {money(v?.price ?? p.price, lang)}
            </span>
            <span className="stock-dot">
              {max > 0
                ? p.demo
                  ? t("inStock")
                  : t("available")
                : t("outStock")}
            </span>
          </div>
          <p
            className="description"
            data-edit-text={`products:${p.id}:description`}
          >
            {p.description[lang]}
          </p>
          {p.demo && <div className="demo-box">{t("demoProduct")}</div>}
          <fieldset className="variant-field">
            <legend>{t("finish")}</legend>
            {variants.map((vv) => (
              <button
                key={vv.id}
                className={variant === vv.id ? "selected" : ""}
                onClick={() => {
                  setVariant(vv.id);
                  setQuantity(1);
                }}
              >
                {vv.name[lang]}
                {variant === vv.id && <Check size={13} />}
              </button>
            ))}
          </fieldset>
          <div className="add-row">
            <div className="quantity">
              <button
                aria-label={t("quantity") + " −"}
                disabled={quantity <= 1}
                onClick={() => setQuantity((q) => q - 1)}
              >
                <Minus size={15} />
              </button>
              <span>{quantity}</span>
              <button
                aria-label={t("quantity") + " +"}
                disabled={quantity >= max}
                onClick={() => setQuantity((q) => q + 1)}
              >
                <Plus size={15} />
              </button>
            </div>
            <button
              className="button"
              disabled={!v || max < 1}
              onClick={() => add(p, variant, quantity)}
            >
              {t("addCart")}
              <Plus size={16} />
            </button>
          </div>
          <p className="micro muted">{t("shippingNote")}</p>
          <div className="detail-tabs" role="tablist">
            {(["specs", "fitment", "installation"] as const).map((key) => (
              <button
                key={key}
                id={`tab-${key}`}
                role="tab"
                aria-selected={tab === key}
                aria-controls="detail-panel"
                onClick={() => setTab(key)}
              >
                {t(key)}
              </button>
            ))}
          </div>
          <div
            className="tab-content"
            id="detail-panel"
            role="tabpanel"
            aria-labelledby={`tab-${tab}`}
          >
            {tab === "specs" ? (
              <>
                <p data-edit-text={`products:${p.id}:specifications`}>
                  {p.specifications[lang]}
                </p>
                <dl>
                  <dt>{t("material")}</dt>
                  <dd>{t(p.material as MessageKey)}</dd>
                  <dt>{t("weight")}</dt>
                  <dd>{p.weight ? `${p.weight} g` : t("notProvided")}</dd>
                  <dt>SKU</dt>
                  <dd>{v?.sku || p.sku}</dd>
                </dl>
              </>
            ) : tab === "installation" ? (
              <p data-edit-text={`products:${p.id}:installation`}>
                {p.installation[lang] || t("notProvided")}
              </p>
            ) : (
              <ul className="fitment-list">
                {c.compatibility
                  .filter((f) => f.product_id === p.id)
                  .map((f) => {
                    const model = c.models.find((m) => m.id === f.model_id),
                      brand = c.brands.find((b) => b.id === model?.brand_id);
                    return (
                      <li key={f.id}>
                        <Link
                          href={href(
                            `/motosikletler/${brand?.slug}/${model?.slug}`,
                          )}
                        >
                          {brand?.name} {model?.name}
                          <span>
                            {f.year_from}—{f.year_to}
                            <ArrowUpRight size={12} />
                          </span>
                        </Link>
                      </li>
                    );
                  })}
              </ul>
            )}
          </div>
          {(p.video_url || p.viewer_url) && (
            <div className="media-links">
              {p.video_url && (
                <a href={p.video_url} target="_blank" rel="noopener noreferrer">
                  {t("video")} ↗
                </a>
              )}
              {p.viewer_url && (
                <a
                  href={p.viewer_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t("viewer")} ↗
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
function Checkout({
  lang,
  cart,
  total,
  href,
  clear,
  preview = false,
}: {
  preview?: boolean;
  lang: Lang;
  cart: CartLine[];
  total: number;
  href: (p: string) => string;
  clear: () => void;
}) {
  const t = useVisualTranslate(lang),
    [status, setStatus] = useState(""),
    [result, setResult] = useState<{ reference: string; demo: boolean } | null>(
      null,
    ),
    [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (preview) {
      setStatus(
        {
          tr: "Tasarım önizlemesinde sipariş gönderilmez.",
          en: "Orders cannot be submitted in design preview.",
          ru: "В режиме предпросмотра заказы не отправляются.",
        }[lang],
      );
      return;
    }
    setBusy(true);
    setStatus("");
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...Object.fromEntries(form),
            consent: form.get("consent") === "on",
            locale: lang,
            lines: cart,
          }),
        }),
        data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResult(data);
      clear();
    } catch (e) {
      setStatus(
        e instanceof Error && e.message === "OUT_OF_STOCK"
          ? t("stockError")
          : t("error"),
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="page-section checkout-page">
      <p className="eyebrow">KUZMIN / {t("checkout")}</p>
      <h1>{result ? t("success") : t("checkoutTitle")}</h1>
      {result ? (
        <div className="confirmation">
          <Check size={32} />
          <p className="reference">{result.reference}</p>
          <p>{result.demo ? t("successDemo") : t("successLive")}</p>
          <Link className="button" href={href("/urunler")}>
            {t("continue")}
            <ArrowUpRight size={16} />
          </Link>
        </div>
      ) : !cart.length ? (
        <div className="empty-state">
          <h2>{t("emptyBag")}</h2>
          <Link className="button" href={href("/urunler")}>
            {t("continue")}
          </Link>
        </div>
      ) : (
        <div className="cart-layout">
          <form className="checkout-form" onSubmit={submit}>
            <p className="demo-box">{t("orderNote")}</p>
            {(
              ["customer_name", "email", "phone", "address", "note"] as const
            ).map((key, i) => (
              <label key={key}>
                {t((["name", "email", "phone", "address", "note"] as const)[i])}
                {key === "address" || key === "note" ? (
                  <textarea
                    name={key}
                    disabled={preview}
                    required={key === "address"}
                    minLength={key === "address" ? 10 : 0}
                    maxLength={key === "address" ? 1000 : 2000}
                    autoComplete={
                      key === "address" ? "street-address" : undefined
                    }
                  />
                ) : (
                  <input
                    name={key}
                    disabled={preview}
                    required
                    type={
                      key === "email"
                        ? "email"
                        : key === "phone"
                          ? "tel"
                          : "text"
                    }
                    minLength={
                      key === "customer_name" ? 2 : key === "phone" ? 7 : 3
                    }
                    maxLength={key === "email" ? 254 : 120}
                    autoComplete={
                      key === "customer_name"
                        ? "name"
                        : key === "phone"
                          ? "tel"
                          : "email"
                    }
                  />
                )}
              </label>
            ))}
            <label className="consent">
              <input
                type="checkbox"
                name="consent"
                required
                disabled={preview}
              />
              {t("consent")}
            </label>
            <Link href={href("/gizlilik")} className="under-link">
              {t("privacy")} ↗
            </Link>
            {status && (
              <p role="alert" className="form-error">
                {status}
              </p>
            )}
            <button
              className="button wide"
              type={preview ? "button" : "submit"}
              disabled={busy}
              onClick={
                preview
                  ? () =>
                      setStatus(
                        {
                          tr: "Tasarım önizlemesinde sipariş gönderilmez.",
                          en: "Orders cannot be submitted in design preview.",
                          ru: "В режиме предпросмотра заказы не отправляются.",
                        }[lang],
                      )
                  : undefined
              }
            >
              {busy ? t("sending") : t("submit")}
              <ArrowRight size={16} />
            </button>
          </form>
          <aside className="order-summary">
            <p className="eyebrow">{t("cart")}</p>
            <div className="summary-total">
              <span>{t("subtotal")}</span>
              <strong>{money(total, lang)}</strong>
            </div>
            <p className="muted">{t("shippingNote")}</p>
            <Link href={href("/sepet")} className="text-link">
              <ArrowLeft size={14} />
              {t("cart")}
            </Link>
          </aside>
        </div>
      )}
    </section>
  );
}
