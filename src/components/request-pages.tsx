"use client";
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowUpRight,
  ArrowLeft,
  Check,
  Plus,
  X,
  Package,
  Layers,
  ArrowRight,
} from "lucide-react";
import type { Catalog, Lang } from "@/lib/types";
import { useVisualCopy, useVisualImage } from "@/lib/visual";
import {
  requestLink,
  requestSchema,
  originalOptions,
  termsLabels,
  type RequestKind,
  type TermsKey,
} from "@/lib/requests";
type Context = Record<string, string | number | undefined>;
export function RequestCards({
  context = {},
  empty = false,
}: {
  context?: Context;
  empty?: boolean;
}) {
  const copy = useVisualCopy("tr");
  return (
    <section className="request-options" aria-label="Parça talep seçenekleri">
      {empty && (
        <div className="request-empty">
          <span className="eyebrow">BİR SONRAKİ PARÇA, SENİNKİ OLABİLİR.</span>
          <h2>Bu motosiklet için henüz satışta ürünümüz bulunmuyor.</h2>
          <p>
            Aradığın parçayı bize anlat. Ürün geliştirme talebi bırak veya
            orijinal parçan için özel üretim değerlendirmesi iste.
          </p>
        </div>
      )}
      <div className="request-option-grid">
        <article>
          <span className="eyebrow">01 / ÜRÜN GELİŞTİRME</span>
          <h3 data-visual-text="slot:requests.demand.title">
            {copy("requests.demand.title", "Aradığın parça burada yok mu?")}
          </h3>
          <p>
            Kataloğumuzda bulunmayan karbonfiber parçayı bildir. Yeni ürün
            geliştirme planımızda değerlendirelim.
          </p>
          <Link className="text-link" href={requestLink("demand", context)}>
            Ürün talebi oluştur <ArrowUpRight size={16} />
          </Link>
        </article>
        <article className="request-custom-option">
          <span className="eyebrow">02 / SANA ÖZEL ÜRETİM</span>
          <h3 data-visual-text="slot:requests.custom.title">
            {copy("requests.custom.title", "Orijinalinden, sana özel.")}
          </h3>
          <p>
            Orijinal parçanı referans alarak karbonfiber üretimi için teknik
            değerlendirme ve teklif iste.
          </p>
          <Link className="text-link" href={requestLink("custom", context)}>
            Özel üretim talebi <ArrowUpRight size={16} />
          </Link>
        </article>
      </div>
    </section>
  );
}
type Settings = {
  ready: boolean;
  demo?: boolean;
  version: number;
  documents: Partial<Record<TermsKey, { text: string; approved: boolean }>>;
};
export function CustomCarbonPage({
  catalog: c,
  lang,
  preview,
  query,
  userEmail = "",
}: {
  catalog: Catalog;
  lang: Lang;
  preview: boolean;
  query?: string;
  userEmail?: string;
}) {
  const copy = useVisualCopy(lang),
    params = new URLSearchParams(query || ""),
    mode = params.get("type");
  const heroImage = useVisualImage("home.custom", "/images/carbon.svg");
  const [kind, setKind] = useState<RequestKind>(
    mode === "demand" ? "demand" : "custom",
  );
  const [selection, setSelection] = useState(() => ({
    brand_id: params.get("brand") || "",
    model_id: params.get("model") || "",
    year: params.get("year") || "",
    category_id: params.get("category") || "",
    product_id: params.get("product") || "",
  }));
  const [photos, setPhotos] = useState<File[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [result, setResult] = useState<{ reference: string; demo: boolean } | null>(
      null,
    ),
    [settings, setSettings] = useState<Settings>({
      ready: preview,
      version: 0,
      documents: {},
    }),
    [loading, setLoading] = useState(!preview),
    [submissionKey] = useState(() => crypto.randomUUID());
  useEffect(() => {
    if (preview) return;
    let cancelled = false;
    fetch("/api/requests/settings")
      .then(async (r) => {
        const data = await r.json();
        if (!cancelled)
          setSettings({
            ready: !!data.ready,
            version: data.version || 0,
            documents: data.documents || {},
            demo: data.demo,
          });
      })
      .catch(() => {
        if (!cancelled)
          setSettings({ ready: false, version: 0, documents: {} });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [preview]);
  const models = c.models.filter((m) => m.brand_id === selection.brand_id),
    years = c.model_years
      .filter((y) => y.model_id === selection.model_id)
      .sort((a, b) => b.year - a.year),
    year = years.find((y) => String(y.year) === selection.year),
    generation = c.generations.find((g) => g.id === year?.generation_id);
  const [previewURLs, setPreviewURLs] = useState<string[]>([]);
  useEffect(() => {
    const urls = photos.map((f) => URL.createObjectURL(f));
    setPreviewURLs(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [photos]);
  function chooseKind(next: RequestKind) {
    setKind(next);
    setError("");
    setPhotos([]);
  }
  function select(key: keyof typeof selection, value: string) {
    setSelection((old) => ({
      ...old,
      [key]: value,
      ...(key === "brand_id"
        ? { model_id: "", year: "" }
        : key === "model_id"
          ? { year: "" }
          : {}),
    }));
  }
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const form = new FormData(e.currentTarget),
      text = (k: string) => String(form.get(k) || "").trim();
    const value = {
      submission_key: submissionKey,
      kind,
      ...selection,
      year: Number(selection.year),
      generation_id: generation?.id || "",
      part_name: text("part_name"),
      part_description: text("part_description"),
      other_part: text("other_part"),
      material: text("material") || "undecided",
      finish: text("finish") || "undecided",
      quantity: Number(form.get("quantity") || 1),
      original: text("original"),
      name: text("name"),
      email: text("email"),
      phone: text("phone"),
      contact: text("contact"),
      city: text("city"),
      country: text("country"),
      note: text("note"),
      source_path: params.get("source") || "/parcani-urettir",
      permission: form.has("permission"),
      accepted_terms: form.getAll("accepted_terms"),
      terms_version: settings.version,
      website: text("website"),
    };
    const parsed = requestSchema.safeParse(value);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message || "Formu kontrol edin.");
      return;
    }
    if (preview) {
      setError(
        "Bu bir taslak önizlemesi. Formun görünümünü deneyebilirsiniz; gerçek talep ve müşteri bilgileri burada kaydedilmez.",
      );
      return;
    }
    if (!settings.ready) {
      setError(
        "Talep hizmeti henüz açılmadı. Lütfen iletişim sayfamızı kullanın.",
      );
      return;
    }
    setBusy(true);
    try {
      const body = new FormData();
      body.set("payload", JSON.stringify(parsed.data));
      for (const file of photos) body.append("photos", file);
      const response = await fetch("/api/requests", { method: "POST", body });
      const data = await response.json();
      if (!response.ok)
        throw Error(data.error || "Talep kaydedilemedi. Yeniden deneyin.");
      setResult(data);
      setPhotos([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gönderim tamamlanamadı.");
    } finally {
      setBusy(false);
    }
  }
  if (result)
    return (
      <section className="page-section request-thanks">
        <Check size={38} strokeWidth={1} />
        <p className="eyebrow">
          {result.demo ? "YEREL DEMO KAYDI" : "TALEBİN ALINDI"}
        </p>
        <h1>
          Bir sonraki adım,
          <br />
          birlikte şekillenecek.
        </h1>
        <p>
          Başvuru referansın: <strong>{result.reference}</strong>
        </p>
        <p>
          Bilgilerini inceleyip tercih ettiğin iletişim kanalından dönüş
          yapacağız. Fiyat ve üretim süresi teknik değerlendirme sonrasında
          netleşir.
        </p>
        <p className="muted">
          Gönderim koşulları ve onay iletilmeden orijinal parçanı kargolama.
        </p>
        <Link className="button" href="/motosikletler">
          Motosikletlere dön <ArrowUpRight size={16} />
        </Link>
      </section>
    );
  return (
    <>
      <section className="custom-hero page-section">
        <div>
          <p className="eyebrow">KUZMIN / CUSTOM CARBON</p>
          <h1 data-visual-text="slot:custom.title">
            {copy(
              "custom.title",
              "Parçanı gönder, sana özel karbonfiber üretelim.",
            )}
          </h1>
          <p className="intro" data-visual-text="slot:custom.intro">
            {copy(
              "custom.intro",
              "Orijinal parçanın formundan yola çıkalım. Fotoğraflarını inceleyelim, üretim olanaklarını birlikte değerlendirelim.",
            )}
          </p>
          <a
            className="button"
            href="#talep-formu"
            onClick={() => chooseKind("custom")}
          >
            Özel üretim teklifi al <ArrowUpRight size={16} />
          </a>
        </div>
        <div className="custom-editorial">
          <Image
            data-visual-image="home.custom"
            src={heroImage || "/images/carbon.svg"}
            width={900}
            height={900}
            alt="Karbon yüzey detayı"
            sizes="(max-width:760px) 100vw, 50vw"
          />
          <div>
            <span className="eyebrow">FORM. MALZEME. KARAKTER.</span>
            <p>Önce parçanı tanıyalım.</p>
            <span>Üretim yapılabilirliği teknik inceleme ile kesinleşir.</span>
          </div>
        </div>
      </section>
      <section className="custom-process">
        <span>01 / Fotoğraflarını paylaş</span>
        <ArrowRight size={17} />
        <span>02 / Teknik değerlendirme</span>
        <ArrowRight size={17} />
        <span>03 / Sana özel teklif</span>
      </section>
      <section className="page-section custom-services">
        <article className="custom-service-primary">
          <span className="eyebrow">ORİJİNAL PARÇAN VARSA</span>
          <h2>Özel üretim talebi</h2>
          <p>
            Orijinal motosiklet parçanı referans alarak sana özel karbonfiber
            üretimi yapalım. Parçanın fotoğraflarını gönder, teknik
            değerlendirme sonrasında sana özel teklif hazırlayalım.
          </p>
          <a
            className="text-link"
            href="#talep-formu"
            onClick={() => chooseKind("custom")}
          >
            Özel üretim teklifi al <ArrowUpRight size={16} />
          </a>
        </article>
        <article>
          <span className="eyebrow">GELECEKTEKİ KOLEKSİYON İÇİN</span>
          <h2>Yeni ürün talebi</h2>
          <p>
            Aradığın karbonfiber parça henüz koleksiyonumuzda yok mu? Bize
            bildir, yeni ürün geliştirme planımızda değerlendirelim.
          </p>
          <a
            className="text-link"
            href="#talep-formu"
            onClick={() => chooseKind("demand")}
          >
            Ürün talebi oluştur <ArrowUpRight size={16} />
          </a>
        </article>
      </section>
      <section className="page-section request-form-section" id="talep-formu">
        <div className="request-form-heading">
          <p className="eyebrow">BİRLİKTE ŞEKİLLENDİRELİM</p>
          <h2>
            {kind === "custom"
              ? "Özel üretim teklifi al."
              : "Aradığın parçayı bize anlat."}
          </h2>
          <p>
            Üyelik gerekmez. Fotoğraflar değerlendirme içindir; fiyat veya
            teslim tarihi taahhüdü oluşturmaz.
          </p>
          {preview && (
            <p className="request-preview-note">
              Tasarım önizlemesi · Gerçek talep gönderimi kapalıdır. Denemek
              için örnek bilgiler kullanın.
            </p>
          )}
        </div>
        <div
          className="request-kind-switch"
          role="group"
          aria-label="Talep türü"
        >
          <button
            className={kind === "custom" ? "selected" : ""}
            aria-pressed={kind === "custom"}
            onClick={() => chooseKind("custom")}
          >
            Özel üretim
          </button>
          <button
            className={kind === "demand" ? "selected" : ""}
            aria-pressed={kind === "demand"}
            onClick={() => chooseKind("demand")}
          >
            Yeni ürün talebi
          </button>
        </div>
        <form className="request-form" onSubmit={submit}>
          <fieldset>
            <legend>01 / Motosikletin</legend>
            <div className="request-field-grid">
              <label>
                Marka
                <select
                  required
                  aria-label="Marka" value={selection.brand_id}
                  onChange={(e) => select("brand_id", e.target.value)}
                >
                  <option value="">Marka seçin…</option>
                  {c.brands.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Model
                <select
                  required
                  disabled={!selection.brand_id}
                  aria-label="Model" value={selection.model_id}
                  onChange={(e) => select("model_id", e.target.value)}
                >
                  <option value="">Model seçin…</option>
                  {models.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Model yılı
                <select
                  required
                  disabled={!selection.model_id}
                  aria-label="Model yılı" value={selection.year}
                  onChange={(e) => select("year", e.target.value)}
                >
                  <option value="">Yıl seçin…</option>
                  {years.map((y) => (
                    <option key={y.id} value={y.year}>
                      {y.year}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Parça kategorisi
                <select
                  aria-label="Parça kategorisi" value={selection.category_id}
                  onChange={(e) => select("category_id", e.target.value)}
                >
                  <option value="">Seçin / diğer</option>
                  {c.categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name[lang] || cat.name.tr}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {generation && (
              <p className="request-prefill">Nesil: {generation.name}</p>
            )}
            {params.get("source") && (
              <p className="request-prefill">
                Motosiklet / ürün sayfasındaki bilgiler aktarıldı. Yukarıdan
                değiştirebilirsin.
              </p>
            )}
          </fieldset>
          <fieldset>
            <legend>02 / Parçan ve beklentin</legend>
            <label>
              İstenen karbonfiber parça
              <input
                name="part_name"
                list="request-parts"
                required
                minLength={2}
                maxLength={200}
                placeholder="Örn. ön çamurluk, depo kaplaması…"
                defaultValue={
                  c.products.find((p) => p.id === selection.product_id)?.title[
                    lang
                  ] || ""
                }
              />
              <datalist id="request-parts">
                {c.products.map((p) => (
                  <option key={p.id} value={p.title[lang]} />
                ))}
              </datalist>
            </label>
            <label>
              Parçanın açıklaması
              <textarea
                name="part_description"
                maxLength={6000}
                rows={3}
                placeholder="Hangi parça, hangi beklenti?"
              />
            </label>
            <label>
              Diğer parça açıklaması (gerekiyorsa)
              <input name="other_part" maxLength={2000} />
            </label>
            {kind === "custom" && (
              <div className="request-field-grid">
                <label>
                  Malzeme / karbonfiber türü
                  <select aria-label="Malzeme / karbonfiber türü" name="material">
                    <option value="undecided">
                      Teknik değerlendirmeyle belirleyelim
                    </option>
                    <option value="full_carbon">Tam karbon fiber</option>
                    <option value="hybrid">Karbon / cam elyaf hibrit</option>
                    <option value="forged">Forged karbon</option>
                    <option value="carbon_finish">Karbon dış yüzey</option>
                  </select>
                </label>
                <label>
                  Yüzey tercihi
                  <select aria-label="Yüzey tercihi" name="finish">
                    <option value="undecided">Henüz karar vermedim</option>
                    <option value="gloss">Parlak</option>
                    <option value="matte">Mat</option>
                  </select>
                </label>
                <label>
                  Miktar
                  <input
                    name="quantity"
                    type="number"
                    min={1}
                    max={1000}
                    step={1}
                    defaultValue={1}
                  />
                </label>
              </div>
            )}
            <label>
              {kind === "custom"
                ? "Üretim için referans alınabilecek orijinal parçayı bize sağlayabilir misiniz?"
                : "Orijinal parçaya erişim durumu"}
              <select aria-label={kind === "custom" ? "Üretim için referans alınabilecek orijinal parçayı bize sağlayabilir misiniz?" : "Orijinal parçaya erişim durumu"} name="original" required defaultValue="">
                <option value="" disabled>
                  Durumunu seçin…
                </option>
                {Object.entries(originalOptions)
                  .filter(([k]) => kind === "custom" || k !== "discuss")
                  .map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
              </select>
            </label>
            <p className="muted">
              Referans parçan olmasa da başvurabilirsin. Talebin teknik
              değerlendirmeye alınır. Onay ve gönderim koşulları iletilmeden
              parçanı kargolama.
            </p>
            <label>
              Referans fotoğrafları{" "}
              {kind === "demand"
                ? "(isteğe bağlı, 1 adet)"
                : "(isteğe bağlı, en fazla 8 adet)"}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple={kind === "custom"}
                onChange={(e) => {
                  const selected = [...(e.target.files || [])];
                  if (
                    selected.length > (kind === "custom" ? 8 : 1) ||
                    selected.some((f) => f.size > 5242880) ||
                    selected.reduce((n, f) => n + f.size, 0) > 20971520
                  ) {
                    setError(
                      "Fotoğraflar dosya başına 5 MB, toplam 20 MB sınırında olmalı.",
                    );
                    e.target.value = "";
                    return;
                  }
                  setPhotos(selected);
                  setError("");
                }}
              />
            </label>
            <div className="request-photo-list">
              {photos.map((file, i) => (
                <figure key={i}>
                  <img src={previewURLs[i]} alt={`Referans ${i + 1}`} />
                  <figcaption>{file.name}</figcaption>
                  <button
                    type="button"
                    aria-label={`${i + 1}. fotoğrafı kaldır`}
                    onClick={() =>
                      setPhotos((old) => old.filter((_, j) => j !== i))
                    }
                  >
                    <X size={16} />
                  </button>
                </figure>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>03 / Sana nasıl ulaşalım?</legend>
            <div className="request-field-grid">
              <label>
                Ad soyad
                <input
                  name="name"
                  required
                  minLength={2}
                  maxLength={200}
                  autoComplete="name"
                />
              </label>
              <label>
                İletişim tercihi
                <select aria-label="İletişim tercihi" name="contact">
                  <option value="either">E-posta veya telefon</option>
                  <option value="email">E-posta</option>
                  <option value="phone">Telefon</option>
                  <option value="whatsapp">WhatsApp</option>
                </select>
              </label>
              <label>
                E-posta
                <input
                  name="email"
                  type="email"
                  maxLength={254}
                  autoComplete="email"
                  defaultValue={userEmail}
                />
              </label>
              <label>
                Telefon
                <input
                  name="phone"
                  type="tel"
                  maxLength={30}
                  autoComplete="tel"
                />
              </label>
              {kind === "custom" && (
                <>
                  <label>
                    Şehir
                    <input
                      name="city"
                      maxLength={200}
                      autoComplete="address-level2"
                    />
                  </label>
                  <label>
                    Ülke
                    <input
                      name="country"
                      maxLength={200}
                      autoComplete="country-name"
                    />
                  </label>
                </>
              )}
            </div>
            <p className="muted">
              E-posta veya telefon bilgilerinden en az biri gereklidir.
            </p>
            <label>
              Ek açıklamalar / özel notlar
              <textarea name="note" maxLength={6000} rows={3} />
            </label>
            <label className="request-honeypot" aria-hidden="true">
              Website
              <input name="website" tabIndex={-1} autoComplete="off" />
            </label>
            <label className="request-check">
              <input type="checkbox" name="permission" required />
              Talebimin değerlendirilmesi için benimle iletişime geçilmesini
              istiyorum. <Link href="/gizlilik">Gizlilik</Link>
            </label>
            {Object.entries(settings.documents).map(([key, doc]) => (
              <details key={key} className="request-terms">
                <summary>
                  {termsLabels[key as TermsKey]} · Sürüm {settings.version}
                </summary>
                <p>{doc.text}</p>
                <label className="request-check">
                  <input type="checkbox" name="accepted_terms" value={key} />
                  {termsLabels[key as TermsKey]} metnini okudum ve kabul
                  ediyorum.
                </label>
              </details>
            ))}
          </fieldset>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          {!preview && !loading && !settings.ready && (
            <p className="form-error" role="status">
              Talep hizmeti henüz açılmadı.{" "}
              <Link href="/iletisim">İletişim sayfası</Link>
            </p>
          )}
          <div className="request-submit">
            <p>
              Gönderimin ardından talep referans numaranı alırsın. Nihai fiyat
              ve koşullar inceleme sonrasında belirlenir.
            </p>
            <button
              className="button"
              disabled={busy || loading || (!preview && !settings.ready)}
            >
              {busy
                ? "Gönderiliyor…"
                : kind === "custom"
                  ? "Özel üretim talebini gönder"
                  : "Ürün talebini gönder"}
              <ArrowUpRight size={16} />
            </button>
          </div>
        </form>
      </section>
    </>
  );
}
