"use client";
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowUpRight, Check, X } from "lucide-react";
import type { Catalog, Lang } from "@/lib/types";
import { useVisualCopy } from "@/lib/visual";
import { requestLink, requestSchema, type RequestKind } from "@/lib/requests";
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
type Settings = { ready: boolean; demo?: boolean };
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
  const params = new URLSearchParams(query || ""),
    kind: RequestKind = params.get("type") === "demand" ? "demand" : "custom";
  const brand = c.brands.find((b) => b.id === params.get("brand")),
    model = c.models.find((m) => m.id === params.get("model"));
  const [photos, setPhotos] = useState<File[]>([]),
    [urls, setURLs] = useState<string[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [result, setResult] = useState<{ reference: string; demo: boolean } | null>(
      null,
    ),
    [settings, setSettings] = useState<Settings>({ ready: preview }),
    [loading, setLoading] = useState(!preview),
    [submissionKey] = useState(() => crypto.randomUUID());
  useEffect(() => {
    if (preview) return;
    let active = true;
    fetch("/api/requests/settings")
      .then((r) => r.json())
      .then((data) => {
        if (active) setSettings({ ready: !!data.ready, demo: data.demo });
      })
      .catch(() => {
        if (active) setSettings({ ready: false });
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [preview]);
  useEffect(() => {
    const values = photos.map((f) => URL.createObjectURL(f));
    setURLs(values);
    return () => values.forEach(URL.revokeObjectURL);
  }, [photos]);
  function addPhotos(e: React.ChangeEvent<HTMLInputElement>) {
    const added = [...(e.target.files || [])];
    e.target.value = "";
    const next = [...photos];
    for (const f of added)
      if (
        !next.some(
          (p) =>
            p.name === f.name &&
            p.size === f.size &&
            p.lastModified === f.lastModified,
        )
      )
        next.push(f);
    if (
      next.length > 8 ||
      next.some((f) => f.size > 5242880) ||
      next.reduce((n, f) => n + f.size, 0) > 20971520
    ) {
      setError(
        "En fazla 8 fotoğraf ekleyin. Dosya başına 5 MB, toplam 20 MB sınırı var.",
      );
      return;
    }
    if (
      added.some(
        (f) => !["image/jpeg", "image/png", "image/webp"].includes(f.type),
      )
    ) {
      setError("JPEG, PNG veya WebP fotoğraf seçin.");
      return;
    }
    setPhotos(next);
    setError("");
  }
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const f = new FormData(e.currentTarget),
      text = (key: string) => String(f.get(key) || "").trim(),
      contact = text("contact_value");
    if (photos.length < 3) {
      setError("En az 3 fotoğraf ekleyin. Parçayı farklı açılardan gösterin.");
      return;
    }
    const parsed = requestSchema.safeParse({
      submission_key: submissionKey,
      kind,
      brand_name: text("brand_name"),
      model_name: text("model_name"),
      brand_id: brand?.id || "",
      model_id: model?.id || "",
      year: Number(text("year")),
      length_cm: Number(text("length_cm")),
      width_cm: Number(text("width_cm")),
      category_id: params.get("category") || "",
      product_id: params.get("product") || "",
      part_description: text("part_description"),
      name: text("name"),
      email: contact.includes("@") ? contact : "",
      phone: contact.includes("@") ? "" : contact,
      contact: contact.includes("@") ? "email" : "phone",
      source_path: params.get("source") || "/parcani-urettir",
      permission: f.has("permission"),
      website: text("website"),
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message || "Bilgileri kontrol edin.");
      return;
    }
    if (preview) {
      setError(
        "Bu bir taslak önizlemesi. Gerçek talep ve müşteri bilgileri burada kaydedilmez.",
      );
      return;
    }
    if (!settings.ready) {
      setError(
        "Talep hizmeti henüz açılmadı. İletişim sayfamızı kullanabilirsiniz.",
      );
      return;
    }
    setBusy(true);
    try {
      const body = new FormData();
      body.set("payload", JSON.stringify(parsed.data));
      photos.forEach((p) => body.append("photos", p));
      const response = await fetch("/api/requests", { method: "POST", body }),
        data = await response.json();
      if (!response.ok) throw Error(data.error || "Talep kaydedilemedi.");
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
        <Check size={36} strokeWidth={1} />
        <p className="eyebrow">
          {result.demo ? "YEREL DEMO KAYDI" : "TALEBİN ALINDI"}
        </p>
        <h1>Teşekkürler.</h1>
        <p>
          Başvuru referansın: <strong>{result.reference}</strong>
        </p>
        <p>
          Parçanı inceleyip paylaştığın iletişim bilgisinden sana ulaşacağız.
          Fiyat ve üretim süresi değerlendirme sonrasında netleşir.
        </p>
        <p className="muted">
          Gönderim koşulları onaylanmadan orijinal parçanı kargolama.
        </p>
        <Link className="text-link" href="/">
          Ana sayfaya dön <ArrowUpRight size={16} />
        </Link>
      </section>
    );
  return (
    <section className="page-section custom-simple-page" id="talep-formu">
      <header className="request-simple-heading">
        <p className="eyebrow">KUZMIN / CUSTOM CARBON</p>
        <h1>
          {kind === "demand" ? "Aradığın parçayı anlat." : "Parçanı ürettir."}
        </h1>
        <p>
          Motorunu, parçanın ölçülerini ve fotoğraflarını paylaş. Detayları
          birlikte netleştirelim.
        </p>
      </header>
      {preview && (
        <p className="request-preview-note">
          Tasarım önizlemesi · Gerçek başvuru gönderilmez. Örnek bilgilerle
          deneyebilirsin.
        </p>
      )}
      <form className="request-form request-simple-form" onSubmit={submit}>
        <div className="request-vehicle-grid">
          <label>
            Marka
            <input
              name="brand_name"
              aria-label="Marka"
              required
              maxLength={200}
              placeholder="Örn. Honda"
              defaultValue={
                params.get("brand_name") ||
                brand?.name ||
                params.get("brand") ||
                ""
              }
            />
          </label>
          <label>
            Model
            <input
              name="model_name"
              aria-label="Model"
              required
              maxLength={200}
              placeholder="Örn. CBR650R"
              defaultValue={
                params.get("model_name") ||
                model?.name ||
                params.get("model") ||
                ""
              }
            />
          </label>
          <label>
            Yıl
            <input
              name="year"
              aria-label="Yıl"
              type="text"
              inputMode="numeric"
              pattern="[0-9]{4}"
              maxLength={4}
              required
              placeholder="2024"
              defaultValue={params.get("year") || ""}
            />
          </label>
        </div>
        <div className="request-field-grid">
          <label>
            Uzunluk (cm)
            <input
              name="length_cm"
              type="number"
              min="0.01"
              max="10000"
              step="any"
              required
              placeholder="Parçanın uzunluğu"
            />
          </label>
          <label>
            Genişlik (cm)
            <input
              name="width_cm"
              type="number"
              min="0.01"
              max="10000"
              step="any"
              required
              placeholder="Parçanın genişliği"
            />
          </label>
        </div>
        <label>
          Açıklama
          <textarea
            name="part_description"
            required
            minLength={3}
            maxLength={6000}
            rows={3}
            placeholder="Hangi parçayı ürettirmek istiyorsun? Kısaca anlat."
            defaultValue={
              c.products.find((p) => p.id === params.get("product"))?.title[
                lang
              ] || ""
            }
          />
        </label>
        <label className="request-simple-upload">
          Fotoğraflar (en az 3)
          <input
            aria-label="Fotoğraflar (en az 3)"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            onChange={addPhotos}
          />
          <span>
            Parçayı farklı açılardan göster. En az 3, en fazla 8 fotoğraf.
          </span>
        </label>
        {!!photos.length && (
          <div className="request-photo-list">
            {photos.map((p, i) => (
              <figure key={i}>
                <img src={urls[i]} alt={"Parça fotoğrafı " + (i + 1)} />
                <figcaption>{p.name}</figcaption>
                <button
                  type="button"
                  aria-label={i + 1 + ". fotoğrafı kaldır"}
                  onClick={() =>
                    setPhotos((old) => old.filter((_, j) => j !== i))
                  }
                >
                  <X size={16} />
                </button>
              </figure>
            ))}
          </div>
        )}
        <p className="request-photo-count" role="status">
          {photos.length < 3
            ? photos.length +
              "/3 fotoğraf · " +
              (3 - photos.length) +
              " fotoğraf daha ekle."
            : photos.length + " fotoğraf eklendi."}
        </p>
        <div className="request-field-grid">
          <label>
            Adınız
            <input
              name="name"
              required
              minLength={2}
              maxLength={200}
              autoComplete="name"
            />
          </label>
          <label>
            Telefon veya e-posta
            <input
              name="contact_value"
              required
              maxLength={254}
              placeholder="Size ulaşabileceğimiz iletişim bilgisi"
              defaultValue={userEmail}
            />
          </label>
        </div>
        <label className="request-honeypot" aria-hidden="true">
          Website
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
        <label className="request-check">
          <input type="checkbox" name="permission" required />
          Talebim için benimle iletişime geçilmesini kabul ediyorum.{" "}
          <Link href="/gizlilik">Gizlilik</Link>
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {!preview && !loading && !settings.ready && (
          <p className="form-error" role="status">
            Talep hizmeti henüz açılmadı. <Link href="/iletisim">İletişim</Link>
          </p>
        )}
        <button
          className="button request-simple-submit"
          disabled={busy || loading || (!preview && !settings.ready)}
        >
          {busy ? "Gönderiliyor…" : "Talebini gönder"}
          <ArrowUpRight size={16} />
        </button>
        <p className="request-simple-note">
          Her marka ve model için başvurabilirsin. Onay ve gönderim koşulları
          iletilmeden parçanı kargolama.
        </p>
      </form>
    </section>
  );
}
