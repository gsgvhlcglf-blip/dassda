"use client";
import { VisualText, useSiteText } from "./visual-text";
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight, Check, X } from "lucide-react";
import type { Catalog, Lang } from "@/lib/types";
import { useVisualImage, useVisualCopy } from "@/lib/visual";
import {
  publicRequestSchema,
  requestMaterialLabels,
  requestMethodLabels,
  type RequestKind,
} from "@/lib/requests";
type Settings = { ready: boolean; demo?: boolean };
function RequestImageChoice({
  name,
  value,
  title,
  subtitle,
  image,
}: {
  name: string;
  value: string;
  title: string;
  subtitle?: string;
  image: string;
}) {
  const visualKey = "requests." + name + "." + value;
  const src = useVisualImage(visualKey, image);
  const captionKey =
    value === "forged" ? "copy.request.jolmjcldghco" : visualKey + ".title";
  const caption = useVisualCopy("tr")(captionKey, title);
  return (
    <label className="request-image-choice" data-visual-image={visualKey}>
      <input
        type="radio"
        name={name}
        value={value}
        required
        aria-label={subtitle ? caption + " (" + subtitle + ")" : caption}
      />
      <Image
        src={src || image}
        alt=""
        fill
        sizes="(max-width: 600px) 45vw, 390px"
        unoptimized
      />
      <span className="request-choice-caption">
        <strong data-visual-text={"slot:" + captionKey}>{caption}</strong>
        {subtitle && <span>{subtitle}</span>}
      </span>
      <span className="request-choice-check" aria-hidden="true">
        <Check size={15} />
      </span>
    </label>
  );
}
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
  const fixedText = useSiteText();

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
      text = (key: string) => String(f.get(key) || "").trim();
    if (photos.length < 3) {
      setError("En az 3 fotoğraf ekleyin. Parçayı farklı açılardan gösterin.");
      return;
    }
    const parsed = publicRequestSchema.safeParse({
      submission_key: submissionKey,
      kind,
      brand_name: text("brand_name"),
      model_name: text("model_name"),
      brand_id: brand?.id || "",
      model_id: model?.id || "",
      year: Number(text("year")),
      length_cm: Number(text("length_cm")),
      width_cm: Number(text("width_cm")),
      material: text("material"),
      manufacturing_method: text("manufacturing_method"),
      category_id: params.get("category") || "",
      product_id: params.get("product") || "",
      part_description: text("part_description"),
      name: text("name"),
      email: text("email"),
      phone: text("phone"),
      contact: "either",
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
          {result.demo ? (
            <VisualText textKey={"slot:copy.request.anlmpdolffpn"} />
          ) : (
            <VisualText textKey={"slot:copy.request.ehcipfajkomj"} />
          )}
        </p>
        <h1 data-visual-text={"slot:copy.request.oogaocmkjjgl"}>
          {fixedText("copy.request.oogaocmkjjgl")}
        </h1>
        <p>
          <VisualText textKey={"slot:copy.request.omboehnljbpk"} />
          <strong>{result.reference}</strong>
        </p>
        <p data-visual-text={"slot:copy.request.aakafdkgdoda"}>
          {fixedText("copy.request.aakafdkgdoda")}
        </p>
        <p
          className="muted"
          data-visual-text={"slot:copy.request.fbalnbkldbbc"}
        >
          {fixedText("copy.request.fbalnbkldbbc")}
        </p>
        <Link className="text-link" href="/">
          <VisualText textKey={"slot:copy.request.hnelfmeolkmc"} />
          <ArrowUpRight size={16} />
        </Link>
      </section>
    );
  return (
    <section className="page-section custom-simple-page" id="talep-formu">
      <header className="request-simple-heading">
        <p
          className="eyebrow"
          data-visual-text={"slot:copy.request.opnkcnafdbao"}
        >
          {fixedText("copy.request.opnkcnafdbao")}
        </p>
        <h1>
          {kind === "demand" ? (
            <VisualText textKey={"slot:copy.request.dnooihdecbpf"} />
          ) : (
            <VisualText textKey={"slot:copy.request.lbdooicebipa"} />
          )}
        </h1>
        <p data-visual-text={"slot:copy.request.kjgahmdjbobb"}>
          {fixedText("copy.request.kjgahmdjbobb")}
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
            <VisualText textKey={"slot:copy.request.mcbkhgmmhhdg"} />
            <input
              name="brand_name"
              aria-label={fixedText("copy.request.mcbkhgmmhhdg")}
              required
              maxLength={200}
              placeholder={fixedText("copy.request.jcopchmcmlnb")}
              defaultValue={
                params.get("brand_name") ||
                brand?.name ||
                params.get("brand") ||
                ""
              }
            />
          </label>
          <label>
            <VisualText textKey={"slot:copy.request.lbjpeklegppn"} />
            <input
              name="model_name"
              aria-label={fixedText("copy.request.lbjpeklegppn")}
              required
              maxLength={200}
              placeholder={fixedText("copy.request.nilbibemaopa")}
              defaultValue={
                params.get("model_name") ||
                model?.name ||
                params.get("model") ||
                ""
              }
            />
          </label>
          <label>
            <VisualText textKey={"slot:copy.request.ehfdmjajbnbl"} />
            <input
              name="year"
              aria-label={fixedText("copy.request.ehfdmjajbnbl")}
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
        <fieldset className="request-image-fieldset">
          <legend data-visual-text={"slot:copy.request.cngekfnobkdp"}>
            {fixedText("copy.request.cngekfnobkdp")}
          </legend>
          <div className="request-image-grid">
            <RequestImageChoice
              name="material"
              value="forged"
              title={fixedText("copy.request.jolmjcldghco")}
              image="/images/carbon-forged.svg"
            />
            <RequestImageChoice
              name="material"
              value="twill"
              title={requestMaterialLabels.twill}
              image="/images/carbon-twill.svg"
            />
          </div>
        </fieldset>
        <fieldset className="request-image-fieldset request-method-fieldset">
          <legend data-visual-text={"slot:copy.request.njimkgmjkhjc"}>
            {fixedText("copy.request.njimkgmjkhjc")}
          </legend>
          <div className="request-method-options">
            <label className="request-method-option">
              <input
                type="radio"
                name="manufacturing_method"
                value="lamination"
                required
                aria-label={requestMethodLabels.lamination}
              />
              <span>
                <strong data-visual-text={"slot:copy.request.dmjohmpekjoh"}>
                  {fixedText("copy.request.dmjohmpekjoh")}
                </strong>
                <small data-visual-text={"slot:copy.request.glcmlekdpcfd"}>
                  {fixedText("copy.request.glcmlekdpcfd")}
                </small>
              </span>
            </label>
            <label className="request-method-option">
              <input
                type="radio"
                name="manufacturing_method"
                value="infusion"
                required
                aria-label={requestMethodLabels.infusion}
              />
              <span>
                <strong data-visual-text={"slot:copy.request.kpaglkibnmck"}>
                  {fixedText("copy.request.kpaglkibnmck")}
                </strong>
                <small data-visual-text={"slot:copy.request.olglhhnklaeg"}>
                  {fixedText("copy.request.olglhhnklaeg")}
                </small>
              </span>
            </label>
          </div>
        </fieldset>
        <div className="request-field-grid">
          <label>
            <VisualText textKey={"slot:copy.request.hbmoemiiobno"} />
            <input
              name="length_cm"
              type="number"
              min="0.01"
              max="10000"
              step="any"
              required
              placeholder={fixedText("copy.request.ealgpkdmcgko")}
            />
          </label>
          <label>
            <VisualText textKey={"slot:copy.request.ldbdhecccaji"} />
            <input
              name="width_cm"
              type="number"
              min="0.01"
              max="10000"
              step="any"
              required
              placeholder={fixedText("copy.request.enfblnboakph")}
            />
          </label>
        </div>
        <label>
          <VisualText textKey={"slot:copy.request.fgengbbdlegh"} />
          <textarea
            name="part_description"
            required
            minLength={3}
            maxLength={6000}
            rows={3}
            placeholder={fixedText("copy.request.ajaoflhajkib")}
            defaultValue={
              c.products.find((p) => p.id === params.get("product"))?.title[
                lang
              ] || ""
            }
          />
        </label>
        <label className="request-simple-upload">
          <VisualText textKey={"slot:copy.request.lcedmpfoldoa"} />
          <input
            aria-label={fixedText("copy.request.lcedmpfoldoa")}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            onChange={addPhotos}
          />
          <span data-visual-text={"slot:copy.request.adjdmfpjknff"}>
            {fixedText("copy.request.adjdmfpjknff")}
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
        <label>
          <VisualText textKey={"slot:copy.request.eippgkgpjbme"} />
          <input
            name="name"
            required
            minLength={2}
            maxLength={200}
            autoComplete="name"
          />
        </label>
        <div className="request-field-grid">
          <label>
            <VisualText textKey={"slot:copy.request.hlghgelhmnch"} />
            <input
              name="phone"
              type="tel"
              required
              maxLength={30}
              autoComplete="tel"
              placeholder={fixedText("copy.request.amfdmpnohinl")}
            />
          </label>
          <label>
            <VisualText textKey={"slot:copy.request.dgnfmijcnnii"} />
            <input
              name="email"
              type="email"
              required
              maxLength={254}
              autoComplete="email"
              placeholder={fixedText("copy.request.gmddjnddpmik")}
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
          <VisualText textKey={"slot:copy.request.fepgbffalddh"} />{" "}
          <Link
            href="/gizlilik"
            data-visual-text={"slot:copy.request.eajpchngmfic"}
          >
            {fixedText("copy.request.eajpchngmfic")}
          </Link>
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {!preview && !loading && !settings.ready && (
          <p className="form-error" role="status">
            <VisualText textKey={"slot:copy.request.iaamephdcpco"} />
            <Link
              href="/iletisim"
              data-visual-text={"slot:copy.request.ijilaffmmicn"}
            >
              {fixedText("copy.request.ijilaffmmicn")}
            </Link>
          </p>
        )}
        <button
          className="button request-simple-submit"
          disabled={busy || loading || (!preview && !settings.ready)}
        >
          {busy ? (
            <VisualText textKey={"slot:copy.request.djahojmcdppf"} />
          ) : (
            <VisualText textKey={"slot:copy.request.dokooefebkmi"} />
          )}
          <ArrowUpRight size={16} />
        </button>
        {fixedText("request.custom.note") && (
          <p
            className="request-simple-note"
            data-visual-text="slot:request.custom.note"
          >
            {fixedText("request.custom.note")}
          </p>
        )}
      </form>
    </section>
  );
}
