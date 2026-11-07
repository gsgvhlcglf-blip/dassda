"use client";
import { useState, useEffect, type FormEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowUpRight,
  ArrowLeft,
  UserRound,
  PackageCheck,
  ImagePlus,
} from "lucide-react";
import { useVisualTranslate, useVisualImage } from "@/lib/visual";
import {
  paginateBlog,
  blogBannerSize,
  blogImageKey,
  blogPageNumber,
} from "@/lib/blog";
import { money } from "@/lib/i18n";
import { trackingConfiguration, trackingLink } from "@/lib/tracking";
import { paymentStatusLabel } from "@/lib/payments/types";
import { safeNext } from "@/lib/customer-navigation";
import type { Catalog, Content, Lang } from "@/lib/types";
export type CustomerView = { id: string; email: string };
type Props = { lang: Lang; href: (path: string) => string };
export function MemberGate({ lang, href }: Props) {
  const t = useVisualTranslate(lang);
  return (
    <section className="page-section member-gate">
      <UserRound size={30} strokeWidth={1} />
      <p className="eyebrow">KUZMIN / {t("account")}</p>
      <h1>{t("membershipRequired")}</h1>
      <p className="intro">{t("membershipIntro")}</p>
      <div className="member-actions">
        <Link className="button" href={href("/giris?next=%2Fodeme")}>
          {t("login")}
          <ArrowUpRight size={16} />
        </Link>
        <Link className="button outline" href={href("/uye-ol?next=%2Fodeme")}>
          {t("signup")}
        </Link>
      </div>
    </section>
  );
}
export function CustomerPage({
  lang,
  href,
  mode,
  preview,
  live,
  user,
  onDemo,
  onNavigate,
  query,
}: Props & {
  mode: "login" | "signup" | "account";
  preview: boolean;
  live: boolean;
  user: CustomerView | null;
  onDemo: () => void;
  onNavigate?: (path: string) => void;
  query?: string;
}) {
  const t = useVisualTranslate(lang),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [orders, setOrders] = useState<
      {
        reference: string;
        status: string;
        total: number;
        created_at: string;
        payment_status?: string;
      }[]
    >([]);
  const go = (path: string) =>
    onNavigate ? onNavigate(path) : window.location.assign(path);
  const next = () =>
    href(
      safeNext(
        new URLSearchParams(query ?? window.location.search).get("next"),
      ),
    );
  useEffect(() => {
    if (mode !== "account" || !user || preview) return;
    let cancelled = false;
    fetch("/api/customer", { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw Error();
        return r.json();
      })
      .then((d) => {
        if (!cancelled) setOrders(d.orders);
      })
      .catch(() => {
        if (!cancelled) setMessage(t("accountError"));
      });
    return () => {
      cancelled = true;
    };
  }, [mode, user?.id, preview, lang]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (preview) return;
    setBusy(true);
    setMessage("");
    const data = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/customer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: mode === "signup" ? "signup" : "login",
          email: data.get("email"),
          password: data.get("password"),
          consent: data.get("consent") === "on",
        }),
      });
      const result = await response.json();
      if (!response.ok) throw Error(result.error);
      if (result.verify) setMessage(t("accountVerify"));
      else go(next());
    } catch (error) {
      setMessage(
        error instanceof Error && error.message === "RATE_LIMITED"
          ? t("accountRateLimit")
          : error instanceof Error && error.message === "INVALID_LOGIN"
            ? t("accountInvalidLogin")
            : t("accountError"),
      );
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    if (preview) {
      onDemo();
      go(href("/giris"));
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/customer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "logout" }),
      });
      if (!response.ok) throw Error();
      go(href("/giris"));
    } catch {
      setMessage(t("accountError"));
      setBusy(false);
    }
  }
  if (mode === "account" && !user)
    return <MemberGate lang={lang} href={href} />;
  if (mode === "account")
    return (
      <section className="page-section account-page">
        <p className="eyebrow">KUZMIN / {t("account")}</p>
        <h1>{t("myOrders")}</h1>
        <div className="account-meta">
          <p>{preview ? t("accountDemo") : user?.email}</p>
          <button className="text-link" onClick={logout} disabled={busy}>
            {t("logout")}
          </button>
        </div>
        {message && <p role="alert">{message}</p>}
        {!orders.length ? (
          <div className="empty-state">
            <PackageCheck size={32} />
            <p>{t("noOrders")}</p>
            <Link className="button" href={href("/urunler")}>
              {t("continue")}
            </Link>
          </div>
        ) : (
          <div className="member-orders">
            {orders.map((order) => (
              <article key={order.reference}>
                <span>{order.reference}</span>
                <span>
                  {new Date(order.created_at).toLocaleDateString(
                    { tr: "tr-TR", en: "en-GB", ru: "ru-RU" }[lang],
                  )}
                </span>
                <span>
                  {(
                    {
                      request_pending: t("orderPending"),
                      reviewing: t("orderReviewing"),
                      confirmed: t("orderConfirmed"),
                      shipped: t("orderShipped"),
                      cancelled: t("orderCancelled"),
                      demo_request: t("orderDemo"),
                    } as Record<string, string>
                  )[order.status] || order.status}
                </span>
                <strong>
                  {money(order.total, lang)}
                  {order.payment_status &&
                    order.payment_status !== "request_only" && (
                      <small className="account-payment-status">
                        {paymentStatusLabel(order.payment_status)}
                      </small>
                    )}
                </strong>
              </article>
            ))}
          </div>
        )}
      </section>
    );
  return (
    <section className="page-section account-page">
      <div className="account-layout">
        <div>
          <p className="eyebrow">KUZMIN / {t("account")}</p>
          <h1>{t(mode === "signup" ? "signup" : "login")}</h1>
          <p className="intro">{t("accountIntro")}</p>
          <p className="muted">{t("membershipIntro")}</p>
        </div>
        <form className="member-form" onSubmit={submit}>
          {preview ? (
            <p className="demo-box">{t("accountDemo")}</p>
          ) : !live ? (
            <p className="demo-box">{t("accountLocal")}</p>
          ) : null}
          <label>
            {t("accountEmail")}
            <input
              name="email"
              type="email"
              autoComplete="email"
              required
              disabled={preview}
            />
          </label>
          <label>
            {t("accountPassword")}
            <input
              name="password"
              type="password"
              minLength={12}
              maxLength={128}
              autoComplete={
                mode === "signup" ? "new-password" : "current-password"
              }
              required
              disabled={preview}
            />
            <small>{t("accountPasswordHint")}</small>
          </label>
          {mode === "signup" && (
            <>
              <label className="checkbox">
                <input
                  type="checkbox"
                  name="consent"
                  required
                  disabled={preview}
                />
                {t("accountConsent")}
              </label>
              <div className="member-actions">
                <Link className="under-link" href={href("/gizlilik")}>
                  {t("privacy")}
                </Link>
                <Link className="under-link" href={href("/kosullar")}>
                  {t("terms")}
                </Link>
              </div>
            </>
          )}
          {message && (
            <p role="status" className="form-error">
              {message}
            </p>
          )}
          {preview ? (
            <button
              type="button"
              className="button wide"
              onClick={() => {
                onDemo();
                go(next());
              }}
            >
              {t("demoMember")}
              <ArrowUpRight size={16} />
            </button>
          ) : (
            <button className="button wide" disabled={busy}>
              {busy
                ? t("accountBusy")
                : t(mode === "signup" ? "signup" : "login")}
              <ArrowUpRight size={16} />
            </button>
          )}
          <Link
            className="text-link"
            href={href(
              (mode === "signup" ? "/giris" : "/uye-ol") +
                "?next=" +
                encodeURIComponent(
                  safeNext(new URLSearchParams(query || "").get("next")),
                ),
            )}
          >
            {t(mode === "signup" ? "login" : "signup")}
            <ArrowUpRight size={14} />
          </Link>
        </form>
      </div>
    </section>
  );
}
export function TrackingPage({ c, lang }: { c: Catalog; lang: Lang }) {
  const t = useVisualTranslate(lang),
    config = trackingConfiguration(c, lang),
    [number, setNumber] = useState(""),
    [message, setMessage] = useState("");
  function submit(event: FormEvent) {
    event.preventDefault();
    const url = trackingLink(config.template, number);
    if (!url) {
      setMessage(t("trackingInvalid"));
      return;
    }
    setMessage("");
    window.open(url, "_blank", "noopener,noreferrer");
  }
  return (
    <section className="page-section tracking-page">
      <p className="eyebrow">KUZMIN / {t("tracking")}</p>
      <h1>{t("tracking")}</h1>
      <p className="intro">{t("trackingIntro")}</p>
      <div className="tracking-card">
        {config.ready ? (
          <>
            <p className="eyebrow">{config.carrier}</p>
            <form onSubmit={submit}>
              <label>
                {t("trackingNumber")}
                <input
                  value={number}
                  onChange={(e) => setNumber(e.target.value)}
                  minLength={3}
                  maxLength={80}
                  pattern="(?:[a-zA-Z0-9]|-)+"
                  autoComplete="off"
                  required
                />
              </label>
              <button className="button" type="submit">
                {t("trackAction")}
                <ArrowUpRight size={16} />
              </button>
            </form>
            <p className="muted">{t("trackingExternal")}</p>
            {!config.template.includes("{tracking}") && (
              <p>{t("trackingManual")}</p>
            )}
            {message && <p role="alert">{message}</p>}
          </>
        ) : (
          <div className="empty-state">
            <PackageCheck size={32} strokeWidth={1} />
            <p>{t("trackingUnconfigured")}</p>
          </div>
        )}
      </div>
    </section>
  );
}
function BlogArtwork({ post }: { post: Content }) {
  const key = blogImageKey(post.id);
  const image = useVisualImage(key, undefined);
  return (
    <div className="blog-banner-media" data-visual-image={key}>
      {image ? (
        <Image
          src={image}
          alt=""
          fill
          sizes="(max-width: 760px) 100vw, 70vw"
          unoptimized
        />
      ) : (
        <div className="blog-image-placeholder" aria-hidden="true">
          <ImagePlus size={28} strokeWidth={1} />
        </div>
      )}
    </div>
  );
}
export function BlogPage({
  c,
  lang,
  slug,
  href,
  query,
}: Props & { c: Catalog; slug?: string; query?: string }) {
  const t = useVisualTranslate(lang);
  const params = new URLSearchParams(query || "");
  const { posts, visible, page, pages } = paginateBlog(
    c.content,
    params.get("page"),
  );
  const post = posts.find((row) => row.key === "blog-" + slug);
  const listLink = (n: number) => href("/blog" + (n > 1 ? "?page=" + n : ""));
  if (post) {
    const title = post.title[lang] || post.title.tr;
    return (
      <section className="page-section prose-page blog-article">
        <Link
          className="text-link"
          href={listLink(Math.min(pages, blogPageNumber(params.get("page"))))}
        >
          <ArrowLeft size={14} />
          {t("blog")}
        </Link>
        <header className="blog-article-banner">
          <BlogArtwork post={post} />
          <div className="blog-banner-shade" />
          <div className="blog-banner-content">
            <h1 data-edit-text={"content:" + post.id + ":title"}>{title}</h1>
          </div>
        </header>
        <div
          className="content-body"
          data-edit-text={"content:" + post.id + ":body"}
        >
          {(post.body[lang] || post.body.tr).split("\n").map((text, i) => (
            <p key={i}>{text}</p>
          ))}
        </div>
      </section>
    );
  }
  const numbers = [...new Set([1, page - 1, page, page + 1, pages])]
    .filter((n) => n >= 1 && n <= pages)
    .sort((a, b) => a - b);
  return (
    <section className="page-section blog-page">
      <header className="blog-page-heading">
        <h1>{t("blog")}</h1>
        <p className="intro">{t("blogIntro")}</p>
      </header>
      {!posts.length ? (
        <div className="empty-state blog-empty">
          <p>{t("blogEmpty")}</p>
        </div>
      ) : (
        <>
          <div className="blog-grid">
            {visible.map((post, index) => {
              const title = post.title[lang] || post.title.tr;
              return (
                <Link
                  key={post.id}
                  className={
                    "blog-card blog-card--" + blogBannerSize(title, index)
                  }
                  href={href(
                    "/blog/" +
                      post.key.slice(5) +
                      (page > 1 ? "?page=" + page : ""),
                  )}
                >
                  <BlogArtwork post={post} />
                  <div className="blog-banner-shade" />
                  <div className="blog-banner-content">
                    <h2 data-edit-text={"content:" + post.id + ":title"}>
                      {title}
                    </h2>
                    <ArrowUpRight size={20} aria-hidden="true" />
                  </div>
                </Link>
              );
            })}
          </div>
          {pages > 1 && (
            <nav className="blog-pagination" aria-label={t("blogPagination")}>
              {page > 1 && (
                <Link
                  className="text-link"
                  href={listLink(page - 1)}
                  rel="prev"
                >
                  <ArrowLeft size={15} />
                  {t("blogPrevious")}
                </Link>
              )}
              <div className="blog-page-numbers">
                {numbers.map((n, i) => (
                  <span key={n}>
                    {i > 0 && n - numbers[i - 1] > 1 && (
                      <span className="blog-page-gap" aria-hidden="true">
                        …
                      </span>
                    )}
                    <Link
                      href={listLink(n)}
                      aria-current={page === n ? "page" : undefined}
                      aria-label={t("blogPageLabel") + " " + n}
                    >
                      {n}
                    </Link>
                  </span>
                ))}
              </div>
              {page < pages && (
                <Link
                  className="text-link"
                  href={listLink(page + 1)}
                  rel="next"
                >
                  {t("blogNext")}
                  <ArrowUpRight size={15} />
                </Link>
              )}
            </nav>
          )}
        </>
      )}
    </section>
  );
}
