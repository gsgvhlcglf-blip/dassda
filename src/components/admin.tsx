"use client";
import { BestsellersSettings } from "./bestsellers-settings";
import { bestsellerRecord, bestsellersKey } from "@/lib/bestsellers";
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { paymentStatusLabel } from "@/lib/payments/types";
import { PaymentSettings } from "./payment-settings";
import { TrackingSettings } from "./tracking-settings";
import { SiteStudio } from "./site-studio";
import { ModelGenerationsEditor } from "./model-generations-editor";
import { ProductCompatibilityEditor } from "./product-compatibility-editor";
import {
  compatibilityInputs,
  type CompatibilityInput,
} from "@/lib/product-compatibility";
import {
  generationInputs,
  type GenerationInput,
} from "@/lib/model-generations";
import { AnalyticsDashboard } from "./analytics-dashboard";
import { RequestDashboard } from "./request-dashboard";
import type { Catalog, Content } from "@/lib/types";
import {
  Plus,
  Search,
  ArrowUpRight,
  LogOut,
  LayoutDashboard,
  Package,
  Bike,
  CalendarDays,
  Layers,
  Images,
  Link2,
  ShoppingBag,
  FileText,
  Tags,
  X,
  Check,
  Upload,
  Trash2,
  ChevronRight,
  Settings,
  BarChart3,
  CreditCard,
} from "lucide-react";
import type { Row } from "@/lib/types";
import { money } from "@/lib/i18n";
type Data = Record<string, Row[]>;
type Field = {
  key: string;
  label: string;
  type?:
    | "text"
    | "number"
    | "checkbox"
    | "localized"
    | "textarea"
    | "image"
    | "select";
  options?: string[];
  relation?: string;
  optional?: boolean;
};
const fields: Record<string, Field[]> = {
  models: [
    { key: "brand_id", label: "Marka", relation: "brands" },
    { key: "name", label: "Model adı" },
    { key: "slug", label: "URL adı (küçük harf, tire)" },
    { key: "image", label: "Model fotoğrafı", type: "image" },
    { key: "published", label: "Yayında", type: "checkbox" },
  ],
  generations: [
    { key: "model_id", label: "Motosiklet modeli", relation: "models" },
    { key: "name", label: "Nesil adı" },
    { key: "start_year", label: "İlk yıl", type: "number" },
    { key: "end_year", label: "Son yıl", type: "number" },
  ],
  model_years: [
    { key: "model_id", label: "Motosiklet modeli", relation: "models" },
    { key: "generation_id", label: "Nesil", relation: "generations" },
    { key: "year", label: "Üretim yılı", type: "number" },
  ],
  products: [
    { key: "title", label: "Ürün adı", type: "localized" },
    { key: "slug", label: "URL adı" },
    { key: "sku", label: "SKU" },
    { key: "category_id", label: "Kategori", relation: "categories" },
    {
      key: "material",
      label: "Malzeme",
      options: ["full_carbon", "hybrid", "forged", "carbon_finish"],
    },
    { key: "price", label: "Görünen fiyat (TRY)", type: "number" },
    { key: "stock", label: "Toplam stok", type: "number" },
    {
      key: "weight",
      label: "Ağırlık (gram, isteğe bağlı)",
      type: "number",
      optional: true,
    },
    { key: "description", label: "Açıklama", type: "localized" },
    { key: "specifications", label: "Teknik detaylar", type: "localized" },
    { key: "installation", label: "Montaj bilgisi", type: "localized" },
    { key: "video_url", label: "Video HTTPS adresi", optional: true },
    { key: "viewer_url", label: "360° görüntü HTTPS adresi", optional: true },
    { key: "featured", label: "Ana sayfada öne çıkar", type: "checkbox" },
    { key: "published", label: "Yayında", type: "checkbox" },
    { key: "demo", label: "Örnek ürün (gerçek satış değil)", type: "checkbox" },
  ],
  variants: [
    { key: "product_id", label: "Ürün", relation: "products" },
    { key: "name", label: "Varyant adı", type: "localized" },
    { key: "sku", label: "Varyant SKU" },
    { key: "price", label: "Satış fiyatı (TRY)", type: "number" },
    { key: "stock", label: "Varyant stoku", type: "number" },
    { key: "finish", label: "Yüzey", options: ["gloss", "matte"] },
  ],
  product_images: [
    { key: "product_id", label: "Ürün", relation: "products" },
    { key: "url", label: "Fotoğraf", type: "image" },
    { key: "alt", label: "Görsel açıklaması", type: "localized" },
    { key: "position", label: "Sıra (0 = kapak)", type: "number" },
  ],
  compatibility: [
    { key: "product_id", label: "Ürün", relation: "products" },
    { key: "model_id", label: "Motosiklet modeli", relation: "models" },
    {
      key: "generation_id",
      label: "Nesil (isteğe bağlı)",
      relation: "generations",
      optional: true,
    },
    { key: "year_from", label: "İlk uyumlu yıl", type: "number" },
    { key: "year_to", label: "Son uyumlu yıl", type: "number" },
  ],
  categories: [
    { key: "name", label: "Kategori adı", type: "localized" },
    { key: "slug", label: "URL adı" },
  ],
  content: [
    { key: "key", label: "Sayfa anahtarı" },
    { key: "title", label: "Başlık", type: "localized" },
    { key: "body", label: "İçerik", type: "localized" },
  ],
  orders: [
    {
      key: "status",
      label: "Sipariş durumu",
      options: [
        "request_pending",
        "reviewing",
        "confirmed",
        "shipped",
        "cancelled",
        "demo_request",
      ],
    },
  ],
};
const sections = [
  ["overview", "Genel bakış", LayoutDashboard],
  ["settings", "Yapılandırma", Settings],
  ["analytics", "Analitik & Isı Haritası", BarChart3],
  ["requests", "Talepler & CRM", FileText],
  ["releases", "Yayın & sürümler", Layers],
  ["bestsellers", "En çok satanlar", Images],
  ["photography", "Fotoğraf düzeni", Images],
  ["payments", "Ödeme altyapısı", CreditCard],
  ["models", "Motosiklet modelleri", Bike],
  ["generations", "Nesiller", Layers],
  ["model_years", "Üretim yılları", CalendarDays],
  ["products", "Ürünler", Package],
  ["variants", "Varyantlar & stok", Tags],
  ["product_images", "Ürün fotoğrafları", Images],
  ["compatibility", "Uyumluluk", Link2],
  ["categories", "Kategoriler", Layers],
  ["orders", "Sipariş talepleri", ShoppingBag],
  ["content", "Sayfa içerikleri", FileText],
] as const;
function name(r: Row) {
  const x = r.title || r.name || r.reference || r.key || r.id;
  return typeof x === "object" && x !== null
    ? String((x as { tr?: string }).tr || r.id)
    : String(x);
}
const labels: Record<string, string> = {
  request_pending: "Talep alındı",
  reviewing: "İnceleniyor",
  confirmed: "Onaylandı",
  shipped: "Gönderildi",
  cancelled: "İptal edildi",
  demo_request: "Demo talebi",
  full_carbon: "Tam karbon fiber",
  hybrid: "Karbon / cam elyaf",
  forged: "Forged karbon",
  carbon_finish: "Karbon dış yüzey",
  gloss: "Parlak",
  matte: "Mat",
};
export function Admin({
  role,
  live,
  initialSection = "overview",
  configuration,
}: {
  initialSection?: "overview" | "settings";
  configuration?: {
    supabaseUrl: boolean;
    supabaseKey: boolean;
    siteUrl: boolean;
    indexing: boolean;
  };
  role: "admin" | "editor" | null;
  live: boolean;
}) {
  const [data, setData] = useState<Data>({}),
    [section, setSection] = useState<string>(initialSection),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [search, setSearch] = useState(""),
    [editing, setEditing] = useState<Row | null>(null),
    [isNew, setIsNew] = useState(false),
    [saving, setSaving] = useState(false),
    [message, setMessage] = useState(""),
    [language, setLanguage] = useState<"tr" | "en" | "ru">("tr"),
    [deletePending, setDeletePending] = useState(false);
  async function load() {
    setLoading(true);
    try {
      const r = await fetch("/api/admin", { cache: "no-store" }),
        d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setData(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Yüklenemedi");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    if (role) void load();
  }, [role]);
  async function login(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const form = new FormData(e.currentTarget);
    try {
      const r = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(form)),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Giriş yapılamadı");
    } finally {
      setSaving(false);
    }
  }
  function newBlog() {
    setSection("content");
    setEditing({
      id: crypto.randomUUID(),
      key: "blog-yeni-yazi-" + Date.now().toString(36),
      title: { tr: "", en: "", ru: "" },
      body: { tr: "", en: "", ru: "" },
    });
    setIsNew(true);
    setDeletePending(false);
    setError("");
  }
  function openNew() {
    const record: Row = { id: crypto.randomUUID() };
    for (const f of fields[section])
      record[f.key] =
        f.type === "localized"
          ? { tr: "", en: "", ru: "" }
          : f.type === "checkbox"
            ? f.key === "demo" ||
              (section === "models" && f.key === "published")
            : f.type === "number"
              ? f.key.includes("year")
                ? 2024
                : 0
              : f.options?.[0] || "";
    if (section === "products") record.weight = null;
    setEditing(record);
    setIsNew(true);
    setDeletePending(false);
    setError("");
  }
  async function mutate(action: string) {
    setSaving(true);
    setError("");
    try {
      let record = editing;
      if (section === "orders")
        record = { id: editing!.id, status: editing!.status };
      const r = await fetch("/api/admin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            table: section,
            action,
            record,
            generationRows:
              section === "models" && action !== "delete"
                ? (record?.generationRows ??
                  generationInputs(data as unknown as Catalog, record!.id))
                : undefined,
            compatibilityRows:
              section === "products" && action !== "delete"
                ? (record?.compatibilityRows ??
                  compatibilityInputs(data as unknown as Catalog, record!.id))
                : undefined,
            expectedRevision: data._workspace?.[0]?.revision,
            inventoryChanged:
              ["products", "variants"].includes(section) &&
              data[section]?.find((r) => r.id === record?.id)?.stock !==
                record?.stock,
          }),
        }),
        d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setEditing(null);
      setMessage(
        action === "delete"
          ? "Kayıt silindi."
          : section === "orders"
            ? "Sipariş güncellendi."
            : "Taslak kaydedildi. Yayın & sürümler bölümünden yayımlayın.",
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "İşlem başarısız");
    } finally {
      setSaving(false);
    }
  }
  async function upload(file: File, field: string) {
    setSaving(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      const r = await fetch("/api/upload", { method: "POST", body: form }),
        d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setEditing((prev) => (prev ? { ...prev, [field]: d.url } : prev));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Yükleme başarısız");
    } finally {
      setSaving(false);
    }
  }
  if (!role)
    return (
      <div className="admin-login">
        <Link href="/" className="wordmark">
          KUZMIN
        </Link>
        <form onSubmit={login}>
          <p className="eyebrow">YÖNETİM / GÜVENLİ GİRİŞ</p>
          <h1>Tekrar hoş geldiniz.</h1>
          <p className="muted">Koleksiyonun her detayını buradan yönetin.</p>
          {!live && (
            <p className="demo-box">
              Yerel yönetim · E-posta: demo@local.test. Windows kurulumunda
              belirlediğiniz şifreyle giriş yapın. Komut satırıyla kurduysanız
              şifre özel .env.local dosyasındadır.
            </p>
          )}
          <label>
            E-posta
            <input
              type="email"
              name="email"
              required
              autoComplete="username"
              defaultValue={live ? "" : "demo@local.test"}
            />
          </label>
          <label>
            Şifre
            <input
              type="password"
              name="password"
              required
              autoComplete="current-password"
            />
          </label>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button className="button wide" disabled={saving}>
            {saving ? "Giriş yapılıyor…" : "Giriş yap"}
            <ArrowUpRight size={16} />
          </button>
          <Link className="under-link" href="/">
            Mağazaya dön
          </Link>
        </form>
      </div>
    );
  const title = sections.find((s) => s[0] === section)?.[1],
    list = (data[section] || []).filter((r) =>
      JSON.stringify(r)
        .toLocaleLowerCase("tr")
        .includes(search.toLocaleLowerCase("tr")),
    );
  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <Link className="wordmark" href="/">
          KUZMIN<span>STUDIO / YÖNETİM</span>
        </Link>
        <nav>
          {sections
            .filter(
              ([key]) =>
                !["analytics", "payments", "requests"].includes(key) ||
                role === "admin",
            )
            .map(([key, label, Icon]) => (
              <button
                aria-label={label}
                className={section === key ? "active" : ""}
                key={key}
                onClick={() => {
                  setSection(key);
                  setSearch("");
                  setError("");
                  setMessage("");
                }}
              >
                <Icon size={17} />
                {label}
                {key === "orders" && <span>{data.orders?.length || 0}</span>}
              </button>
            ))}
        </nav>
        <div className="admin-sidebar-bottom">
          <span>
            {role === "admin" ? "Yönetici" : "İçerik editörü"} ·{" "}
            {live ? "SUPABASE" : "LOCAL DEMO"}
          </span>
          <Link href="/" target="_blank">
            Mağazayı görüntüle <ArrowUpRight size={14} />
          </Link>
          <button
            onClick={async () => {
              await fetch("/api/auth", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ logout: true }),
              });
              window.location.reload();
            }}
          >
            <LogOut size={14} />
            Çıkış yap
          </button>
        </div>
      </aside>
      <main className="admin-main">
        <header className="admin-header">
          <p className="eyebrow">KU Z M I N / STUDIO</p>
          <span className="micro">
            {live ? "CANLI VERİTABANI" : "DEMO ÇALIŞMA ALANI"}
          </span>
        </header>
        <div className="admin-title">
          <div>
            <p className="eyebrow">KOLEKSİYONUNUZUN KONTROLÜ SİZDE.</p>
            <h1>{title}</h1>
          </div>
          {![
            "overview",
            "orders",
            "settings",
            "analytics",
            "releases",
            "photography",
            "bestsellers",
            "payments",
            "requests",
          ].includes(section) && (
            <button className="button" onClick={openNew}>
              <Plus size={16} />
              Yeni kayıt
            </button>
          )}
        </div>
        {![
          "orders",
          "analytics",
          "releases",
          "photography",
          "payments",
          "requests",
        ].includes(section) && (
          <p className="draft-preview-notice">
            İçerik değişiklikleri taslakta saklanır.{" "}
            <button
              className="under-link"
              onClick={() => setSection("releases")}
            >
              Yayın & sürümler →
            </button>
          </p>
        )}
        {section === "content" && (
          <button className="button" onClick={newBlog}>
            Blog yazısı ekle
          </button>
        )}
        {message && (
          <p className="admin-success" role="status">
            <Check size={16} />
            {message}
          </p>
        )}
        {error && !editing && (
          <p className="form-error" role="alert">
            {error}
            <button className="under-link" onClick={load}>
              Tekrar yükle
            </button>
          </p>
        )}
        {loading ? (
          <div className="empty-state" aria-busy="true">
            Yükleniyor…
          </div>
        ) : section === "bestsellers" ? (
          <BestsellersSettings
            key={String(data._workspace?.[0]?.revision || "initial")}
            catalog={data as unknown as Catalog}
            onSave={async (config) => {
              const existing = data.content?.find(
                (row) => row.key === bestsellersKey,
              ) as import("@/lib/types").Content | undefined;
              const response = await fetch("/api/admin", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  table: "content",
                  action: existing ? "update" : "insert",
                  record: bestsellerRecord(config, existing),
                  expectedRevision: data._workspace?.[0]?.revision,
                }),
              });
              const body = await response.json();
              if (!response.ok) throw Error(body.error || "Kaydedilemedi.");
              await load();
              setMessage(
                "Vitrin kaydedildi. Yayın & sürümler bölümünden yayımlayabilirsiniz.",
              );
            }}
          />
        ) : ["releases", "photography"].includes(section) ? (
          <SiteStudio
            mode={section as "releases" | "photography"}
            role={role}
            onSaved={load}
          />
        ) : section === "payments" && role === "admin" ? (
          <PaymentSettings />
        ) : section === "analytics" && role === "admin" ? (
          <AnalyticsDashboard />
        ) : section === "requests" && role === "admin" ? (
          <RequestDashboard />
        ) : section === "settings" ? (
          <div className="settings-grid">
            <TrackingSettings
              record={
                data.content?.find((row) => row.key === "shipping-tracking") as
                  Content | undefined
              }
              onSave={async (record, isNew) => {
                const response = await fetch("/api/admin", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    table: "content",
                    action: isNew ? "insert" : "update",
                    record,
                  }),
                });
                if (!response.ok) throw Error();
                await load();
              }}
            />
            <section className="admin-guide">
              <p className="eyebrow">BLOG</p>
              <h2>Yeni yazınızı hazırlayın.</h2>
              <p className="muted">
                Başlık ve içeriği üç dilde ekleyin. Sayfa anahtarı blog- ile
                başlar; devamı yazının adresi olur. Kaydettiğiniz yazı blogda
                görünür.
              </p>
              <button className="button" onClick={newBlog}>
                Blog yazısı ekle
              </button>
            </section>
            <section className="admin-guide">
              <p className="eyebrow">MAĞAZA İÇERİĞİ</p>
              <h2>Değiştirmek istediğiniz detayı seçin.</h2>
              <p className="muted">
                Metinleri üç dilde düzenleyebilirsiniz. Kaydettiğiniz
                değişiklikler mağazada hemen görünür.
              </p>
              <div className="guide-steps">
                {[
                  ["home", "Ana sayfa başlığı ve açıklaması"],
                  ["about", "Hakkımızda"],
                  ["contact", "İletişim bilgileri"],
                  ["faq", "Sık sorulan sorular"],
                  ["shipping", "Teslimat ve iade"],
                  ["privacy", "Gizlilik politikası"],
                  ["terms", "Kullanım koşulları"],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => {
                      const record = data.content?.find((r) => r.key === key);
                      if (record) {
                        setSection("content");
                        setEditing(structuredClone(record));
                        setIsNew(false);
                        setError("");
                        setDeletePending(false);
                      }
                    }}
                    disabled={!data.content?.some((r) => r.key === key)}
                  >
                    <div>
                      <h3>{label}</h3>
                    </div>
                    <ChevronRight size={17} />
                  </button>
                ))}
              </div>
            </section>
            <div>
              <section className="admin-guide settings-status">
                <p className="eyebrow">ÇALIŞMA ORTAMI</p>
                <h2>{live ? "Supabase yapılandırması" : "Yerel demo"}</h2>
                <dl>
                  <dt>Veritabanı sorgusu</dt>
                  <dd>
                    {data.brands?.length ? "Başarılı" : "Kontrol gerekli"}
                  </dd>
                  <dt>Supabase proje adresi</dt>
                  <dd>
                    {configuration?.supabaseUrl ? "Tanımlı" : "Tanımlanmamış"}
                  </dd>
                  <dt>Supabase genel anahtarı</dt>
                  <dd>
                    {configuration?.supabaseKey ? "Tanımlı" : "Tanımlanmamış"}
                  </dd>
                  <dt>Yayın alan adı</dt>
                  <dd>
                    {configuration?.siteUrl ? "Tanımlı" : "Tanımlanmamış"}
                  </dd>
                  <dt>Arama motoru indeksleme</dt>
                  <dd>{configuration?.indexing ? "Açık" : "Kapalı"}</dd>
                  <dt>Diller / Para birimi</dt>
                  <dd>TR / TRY</dd>
                  <dt>Ödeme</dt>
                  <dd>Sipariş talebi</dd>
                  <dt>Hostinger / MySQL</dt>
                  <dd>Veri arayüzleri hazır · Bağlantı kurulmadı</dd>
                </dl>
                <p className="muted">
                  Tanımlı alanlar bağlantının doğrulandığı anlamına gelmez.
                  Supabase bağlantı bilgileri ve yayın alan adı, barındırma
                  hizmetinin ortam ayarlarından yönetilir. Gizli değerler bu
                  ekranda gösterilmez. MySQL bağlantısı sonraki kurulum
                  aşamasında sunucu veri adaptörü üzerinden eklenecektir.
                </p>
              </section>
              <section className="admin-guide settings-help">
                <p className="eyebrow">GÜVENLİ ERİŞİM</p>
                <p>
                  {live
                    ? "Hesap ve şifre işlemleri Supabase Authentication üzerinden yönetilir."
                    : "Demo giriş e-postası: demo@local.test. Windows kurulumunda belirlediğiniz şifreyi kullanın. Komut satırı kurulumunda şifre özel .env.local dosyasındadır."}
                </p>
                <button
                  className="text-link"
                  onClick={() => setSection("models")}
                >
                  Motosikletleri yönet <ArrowUpRight size={14} />
                </button>
                <button
                  className="text-link"
                  onClick={() => setSection("products")}
                >
                  Ürünleri yönet <ArrowUpRight size={14} />
                </button>
              </section>
            </div>
          </div>
        ) : section === "overview" ? (
          <>
            <div className="admin-stats">
              {[
                ["Ürün", data.products?.length || 0],
                ["Motosiklet", data.models?.length || 0],
                ["Uyumluluk kaydı", data.compatibility?.length || 0],
                ["Sipariş talebi", data.orders?.length || 0],
              ].map(([label, value]) => (
                <div key={label}>
                  <span className="micro muted">{label}</span>
                  <strong>{value}</strong>
                  <span className="stat-line" />
                </div>
              ))}
            </div>
            <div className="admin-guide">
              <p className="eyebrow">İLK KOLEKSİYONUNUZ</p>
              <h2>Bir parçadan, eksiksiz bir deneyime.</h2>
              <p className="muted">
                Aşağıdaki sırayla yeni ürün ve motosikletlerinizi
                ekleyebilirsiniz. Kaydettiğiniz yayınlanmış içerikler mağazada
                hemen görünür.
              </p>
              <div className="guide-steps">
                {[
                  [
                    "models",
                    "01",
                    "Motosikleti ekleyin",
                    "Markayı seçin, modele bir isim ve fotoğraf ekleyin.",
                  ],
                  [
                    "generations",
                    "02",
                    "Nesil ve yılları tanımlayın",
                    "Önce nesli, sonra her üretim yılını ekleyin.",
                  ],
                  [
                    "products",
                    "03",
                    "Ürünü oluşturun",
                    "Ürün bilgilerini, varyant fiyatlarını ve stokları girin.",
                  ],
                  [
                    "product_images",
                    "04",
                    "Fotoğrafları yükleyin",
                    "Birden fazla görsel ekleyip sıralayın.",
                  ],
                  [
                    "compatibility",
                    "05",
                    "Uyumluluğu bağlayın",
                    "Ürün, model, nesil ve yıl aralığını seçin.",
                  ],
                ].map(([key, n, h, p]) => (
                  <button key={key} onClick={() => setSection(key)}>
                    <span>{n}</span>
                    <div>
                      <h3>{h}</h3>
                      <p>{p}</p>
                    </div>
                    <ChevronRight size={17} />
                  </button>
                ))}
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="admin-search">
              <Search size={17} />
              <input
                placeholder={`${title} içinde ara…`}
                aria-label="Kayıtlarda ara"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <span>{list.length} kayıt</span>
            </div>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Kayıt</th>
                    <th>{section === "orders" ? "Müşteri" : "Detay"}</th>
                    <th>
                      {section === "orders" ? "Toplam" : "Durum / İlişki"}
                    </th>
                    <th>
                      <span className="sr-only">Düzenle</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <strong>{name(r)}</strong>
                        <span className="micro muted">
                          {String(r.sku || r.slug || r.id).slice(0, 48)}
                        </span>
                      </td>
                      <td>
                        {section === "orders" ? (
                          <>
                            {String(r.customer_name)}
                            <span className="micro muted">
                              {String(r.email)}
                            </span>
                          </>
                        ) : section === "compatibility" ? (
                          <>
                            {name(
                              data.products?.find(
                                (p) => p.id === r.product_id,
                              ) || r,
                            )}
                            <span className="micro muted">
                              {String(r.year_from)} — {String(r.year_to)}
                            </span>
                          </>
                        ) : r.url ? (
                          <img
                            className="admin-thumb"
                            src={String(r.url)}
                            alt="Ürün fotoğrafı"
                          />
                        ) : r.price !== undefined ? (
                          money(Number(r.price))
                        ) : (
                          String(
                            r.year ||
                              r.key ||
                              (r.name &&
                                typeof r.name === "string" &&
                                r.name) ||
                              (r.start_year &&
                                `${r.start_year}—${r.end_year}`) ||
                              "—",
                          )
                        )}
                      </td>
                      <td>
                        {section === "orders" ? (
                          <>
                            {money(Number(r.total))}
                            <span className="status-tag">
                              {labels[String(r.status)] || String(r.status)}
                            </span>
                          </>
                        ) : section === "models" ||
                          r.published !== undefined ? (
                          <span className="status-tag">
                            {(
                              section === "models"
                                ? r.published !== false
                                : r.published
                            )
                              ? "Yayında"
                              : "Yayında değil"}
                            {r.demo ? " · Demo" : ""}
                          </span>
                        ) : r.model_id ? (
                          name(
                            data.models?.find((m) => m.id === r.model_id) || r,
                          )
                        ) : r.product_id ? (
                          name(
                            data.products?.find((p) => p.id === r.product_id) ||
                              r,
                          )
                        ) : (
                          String(
                            r.brand_id ||
                              (r.stock !== undefined && `Stok: ${r.stock}`) ||
                              "—",
                          )
                        )}
                      </td>
                      <td>
                        <button
                          className="under-link"
                          onClick={() => {
                            setEditing(structuredClone(r));
                            setIsNew(false);
                            setDeletePending(false);
                            setError("");
                          }}
                        >
                          Düzenle <ArrowUpRight size={12} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!list.length && <p className="empty">Henüz kayıt bulunmuyor.</p>}
            </div>
          </>
        )}
      </main>
      {editing && (
        <div
          className="modal-backdrop"
          onClick={() => {
            if (!saving) setEditing(null);
          }}
        >
          <section
            className="admin-modal"
            role="dialog"
            aria-modal="true"
            aria-label={`${title} düzenle`}
            onClick={(e) => e.stopPropagation()}
          >
            <header>
              <div>
                <p className="eyebrow">{title}</p>
                <h2>{isNew ? "Yeni kayıt" : name(editing)}</h2>
              </div>
              <button
                autoFocus
                className="icon-button"
                aria-label="Kapat"
                onClick={() => setEditing(null)}
              >
                <X />
              </button>
            </header>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void mutate(isNew ? "insert" : "update");
              }}
            >
              {fields[section]?.some((f) => f.type === "localized") && (
                <div className="translation-tabs">
                  {(["tr", "en", "ru"] as const).map((l) => (
                    <button
                      type="button"
                      className={language === l ? "selected" : ""}
                      key={l}
                      onClick={() => setLanguage(l)}
                    >
                      {l.toUpperCase()}
                    </button>
                  ))}
                </div>
              )}
              {section === "orders" && (
                <div className="order-admin-details">
                  <p>
                    <b>{String(editing.customer_name)}</b>
                    <br />
                    {String(editing.email)} · {String(editing.phone)}
                  </p>
                  <p>{String(editing.address)}</p>
                  <p>{String(editing.note)}</p>
                  <p className="micro">{String(editing.created_at)}</p>
                  {data.order_items
                    ?.filter((i) => i.order_id === editing.id)
                    .map((i) => (
                      <p key={i.id}>
                        {String(i.title)} / {String(i.sku)} ×{" "}
                        {String(i.quantity)}{" "}
                        <b>
                          {money(Number(i.unit_price) * Number(i.quantity))}
                        </b>
                      </p>
                    ))}
                  <strong>{money(Number(editing.total))}</strong>
                  <p>
                    Ödeme:{" "}
                    {paymentStatusLabel(
                      String(editing.payment_status || "request_only"),
                    )}{" "}
                    {editing.payment_provider
                      ? " / " + String(editing.payment_provider)
                      : ""}
                  </p>
                  {data.payment_attempts
                    ?.filter((p) => p.order_id === editing.id)
                    .map((p) => (
                      <div key={p.id} className="payment-admin-summary">
                        <p>Sağlayıcı referansı: {String(p.merchant_ref)}</p>
                        <p>
                          İşlem:{" "}
                          {String(
                            p.provider_payment_id || "Henüz doğrulanmadı",
                          )}{" "}
                          · {String(p.mode) === "test" ? "Test modu" : "Canlı"}
                        </p>
                        {p.state === "review" && (
                          <p className="form-error">
                            Otomatik onay durduruldu. Sağlayıcı panelinden
                            tutarı ve işlem durumunu inceleyin.
                          </p>
                        )}
                      </div>
                    ))}
                  {!!editing.demo && (
                    <p className="demo-box">
                      Demo talebi. Gerçek sipariş veya ödeme değildir.
                    </p>
                  )}
                </div>
              )}
              {fields[section]?.map((f) => {
                const value =
                  f.key === "published" && section === "models"
                    ? editing[f.key] !== false
                    : editing[f.key];
                const set = (v: unknown) =>
                  setEditing({ ...editing, [f.key]: v });
                if (f.type === "checkbox")
                  return (
                    <label className="checkbox-field" key={f.key}>
                      <input
                        type="checkbox"
                        aria-label={f.label}
                        checked={!!value}
                        onChange={(e) => set(e.target.checked)}
                      />
                      {f.label}
                      {f.key === "published" && (
                        <span className="micro muted">
                          İşareti kaldırınca kayıt panelde korunur. Kaydedip
                          taslağı yayınladığınızda müşteri görünümünden
                          kaldırılır.
                        </span>
                      )}
                    </label>
                  );
                if (f.type === "localized")
                  return (
                    <label key={f.key}>
                      {f.label}{" "}
                      <span className="micro muted">
                        / {language.toUpperCase()}
                      </span>
                      <textarea
                        aria-label={`${f.label} / ${language.toUpperCase()}`}
                        value={String(
                          (value as Record<string, string>)?.[language] || "",
                        )}
                        onChange={(e) =>
                          set({
                            ...(value as object),
                            [language]: e.target.value,
                          })
                        }
                        rows={
                          f.key === "title" ||
                          f.key === "name" ||
                          f.key === "alt"
                            ? 2
                            : 5
                        }
                      />
                      <span className="micro muted">
                        TR, EN ve RU sekmelerinden her dilin içeriğini
                        düzenleyin.
                      </span>
                    </label>
                  );
                if (f.relation || f.options) {
                  const options =
                    f.options?.map((o) => ({ id: o, label: labels[o] || o })) ||
                    data[f.relation!]
                      ?.filter(
                        (r) =>
                          f.relation !== "generations" ||
                          r.model_id === editing.model_id,
                      )
                      .map((r) => ({ id: r.id, label: name(r) })) ||
                    [];
                  return (
                    <label key={f.key}>
                      {f.label}
                      <select
                        aria-label={f.label}
                        required={!f.optional}
                        value={String(value || "")}
                        onChange={(e) => set(e.target.value || null)}
                      >
                        <option value="">Seçin…</option>
                        {options.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  );
                }
                return (
                  <label key={f.key}>
                    {f.label}
                    {f.type === "image" && (
                      <>
                        <div className="upload-box">
                          <Upload size={20} />
                          <span>Fotoğraf seçin · JPEG, PNG, WebP · 5 MB</span>
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            aria-label={f.label + " yükle"}
                            onChange={(e) => {
                              if (e.target.files?.[0])
                                void upload(e.target.files[0], f.key);
                            }}
                          />
                        </div>
                        {!!value && (
                          <img
                            className="upload-preview"
                            src={String(value)}
                            alt="Yüklenen fotoğraf"
                          />
                        )}
                      </>
                    )}
                    <input
                      aria-label={f.label}
                      type={f.type === "number" ? "number" : "text"}
                      min={f.type === "number" ? 0 : undefined}
                      step={
                        f.key === "price" || f.key === "weight" ? "0.01" : 1
                      }
                      required={!f.optional && f.type !== "image"}
                      value={value === null ? "" : String(value ?? "")}
                      onChange={(e) =>
                        set(
                          f.type === "number"
                            ? e.target.value === ""
                              ? null
                              : Number(e.target.value)
                            : e.target.value,
                        )
                      }
                    />
                  </label>
                );
              })}
              {error && (
                <p role="alert" className="form-error">
                  {error}
                </p>
              )}
              {section === "models" && (
                <ModelGenerationsEditor
                  value={
                    (editing.generationRows as GenerationInput[] | undefined) ??
                    generationInputs(data as unknown as Catalog, editing.id)
                  }
                  onChange={(generationRows) =>
                    setEditing({ ...editing, generationRows })
                  }
                />
              )}
              {section === "products" && (
                <ProductCompatibilityEditor
                  catalog={data as unknown as Catalog}
                  value={
                    (editing.compatibilityRows as
                      CompatibilityInput[] | undefined) ??
                    compatibilityInputs(data as unknown as Catalog, editing.id)
                  }
                  onChange={(compatibilityRows) =>
                    setEditing({ ...editing, compatibilityRows })
                  }
                />
              )}
              <div className="modal-actions">
                {!isNew &&
                  section !== "orders" &&
                  role === "admin" &&
                  (deletePending ? (
                    <button
                      type="button"
                      className="danger-button"
                      disabled={saving}
                      onClick={() => mutate("delete")}
                    >
                      Silme işlemini onayla
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="under-link danger"
                      onClick={() => setDeletePending(true)}
                    >
                      <Trash2 size={14} />
                      Sil
                    </button>
                  ))}
                <button
                  type="button"
                  className="text-link"
                  onClick={() => setEditing(null)}
                >
                  Vazgeç
                </button>
                <button className="button" disabled={saving}>
                  {saving ? "İşleniyor…" : "Kaydet"}
                  <Check size={16} />
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
