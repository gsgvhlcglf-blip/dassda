"use client";
import { useEffect, useRef, useState } from "react";
import type { Workspace } from "@/lib/site-version";
import { defaultPhotography, type Photography } from "@/lib/photography";
import { HeroVideoSettings } from "./hero-video-settings";
import type { HeroVideoAsset } from "@/lib/hero-video";
import { SiteTextsEditor } from "./site-texts-editor";
export function SiteStudio({
  mode,
  role,
  onSaved,
}: {
  mode: "releases" | "photography" | "texts";
  role: "admin" | "editor";
  onSaved: () => void;
}) {
  const [data, setData] = useState<Workspace | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [photo, setPhoto] = useState<Photography>(defaultPhotography),
    frame = useRef<HTMLIFrameElement>(null);
  async function load() {
    try {
      const r = await fetch("/api/admin/studio", { cache: "no-store" }),
        body = await r.json();
      if (!r.ok) throw Error(body.error);
      setData(body);
      setPhoto(body.snapshot.design.photography || defaultPhotography);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Yüklenemedi.");
    }
  }
  useEffect(() => {
    setData(null);
    void load();
  }, [mode]);
  async function action(action: string, versionId?: string) {
    if (!data) return;
    if (
      action === "restore" &&
      !confirm(
        "Bu sürüm yayımlansın mı? Mevcut taslak sürüm geçmişine kaydedilir. Stoklar ve siparişler korunur.",
      )
    )
      return;
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/admin/studio", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            versionId,
            expectedRevision: data.revision,
            design: { ...data.snapshot.design, photography: photo },
          }),
        }),
        body = await r.json();
      if (!r.ok) throw Error(body.error);
      setData(body);
      onSaved();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Kaydedilemedi.");
    } finally {
      setBusy(false);
    }
  }
  const update = (next: Photography) => {
    setPhoto(next);
    if (data)
      frame.current?.contentWindow?.postMessage(
        {
          type: "kz-photo-preview",
          design: { ...data.snapshot.design, photography: next },
        },
        location.origin,
      );
  };
  async function saveHeroVideo(heroVideo: HeroVideoAsset | null) {
    if (!data) return;
    const response = await fetch("/api/admin/studio", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "design",
        expectedRevision: data.revision,
        design: { ...data.snapshot.design, heroVideo },
      }),
    });
    const body = await response.json();
    if (!response.ok) throw Error(body.error || "Video kaydedilemedi.");
    setData(body);
    onSaved();
  }
  async function saveText(key: string, value: string | null) {
    if (!data) return;
    const design = structuredClone(data.snapshot.design);
    design.texts.tr ||= {};
    if (value === null) delete design.texts.tr[key];
    else design.texts.tr[key] = value;
    const response = await fetch("/api/admin/studio", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "design",
        expectedRevision: data.revision,
        design,
      }),
    });
    const body = await response.json();
    if (!response.ok) throw Error(body.error || "Metin kaydedilemedi.");
    setData(body);
    onSaved();
  }
  useEffect(() => {
    const listener = (event: MessageEvent) => {
      if (
        event.source === frame.current?.contentWindow &&
        event.data?.type === "kz-photo-ready" &&
        data
      )
        frame.current?.contentWindow?.postMessage(
          {
            type: "kz-photo-preview",
            design: { ...data.snapshot.design, photography: photo },
          },
          location.origin,
        );
    };
    window.addEventListener("message", listener);
    return () => window.removeEventListener("message", listener);
  }, [data, photo]);
  if (!data)
    return (
      <p role={error ? "alert" : "status"}>
        {error || "Çalışma alanı yükleniyor…"}
      </p>
    );
  return (
    <div className="studio-dashboard">
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {mode === "texts" ? (
        <SiteTextsEditor design={data.snapshot.design} onSave={saveText} />
      ) : mode === "releases" ? (
        <>
          <section className="analytics-card">
            <p className="eyebrow">TASLAK → YAYIN → GERİ AL</p>
            <h2>Son söz sizde.</h2>
            <p>
              İçerik, fiyat ve fotoğraf değişiklikleri taslakta kalır.
              Yayınladığınız sürüm müşterilere gösterilir. Stoklar ve sipariş
              durumları anlık güncellenir; sürüm geri alma bunları değiştirmez.
            </p>
            <p>
              Son yayın:{" "}
              {data.history.find((v) => v.id === data.published_id)
                ? new Date(
                    data.history.find((v) => v.id === data.published_id)!
                      .created_at,
                  ).toLocaleString("tr-TR")
                : "Henüz bu panelden yayın yapılmadı."}
            </p>
            <div className="actions">
              <a
                className="button outline"
                href="/taslak-onizleme"
                target="_blank"
                rel="noopener"
              >
                Taslağı önizle ↗
              </a>
              <a
                className="button outline"
                href="/"
                target="_blank"
                rel="noopener"
              >
                Yayımlanan siteyi gör ↗
              </a>
              {role === "admin" && (
                <button
                  className="button"
                  disabled={busy}
                  onClick={() => void action("publish")}
                >
                  {busy ? "İşleniyor…" : "Taslağı yayınla"}
                </button>
              )}
            </div>
          </section>
          <section className="analytics-card">
            <h3>Sürüm geçmişi</h3>
            <p>
              Son 12 sürüm saklanır. Geri alma öncesindeki taslak ayrıca
              kaydedilir.
            </p>
            {!data.history.length && (
              <p>İlk yayınınızdan sonra sürümler burada görünür.</p>
            )}
            {data.history.map((version) => (
              <div className="studio-version" key={version.id}>
                <div>
                  <strong>
                    {version.label}{" "}
                    {version.id === data.published_id ? "· Şu an yayında" : ""}
                  </strong>
                  <p>
                    {new Date(version.created_at).toLocaleString("tr-TR")} ·{" "}
                    {version.id.slice(0, 8)}
                  </p>
                </div>
                {role === "admin" && version.id !== data.published_id && (
                  <button
                    className="button outline"
                    disabled={busy}
                    onClick={() => void action("restore", version.id)}
                  >
                    Bu sürüme dön
                  </button>
                )}
              </div>
            ))}
          </section>
        </>
      ) : (
        <>
          <HeroVideoSettings
            value={data.snapshot.design.heroVideo}
            onSave={saveHeroVideo}
          />
          <section className="analytics-card">
            <h2>Tek koleksiyon, ortak fotoğraf dili.</h2>
            <p>
              Ayarlar ürün kartlarına ve ürün galerisine uygulanır. Orijinal
              fotoğraflar değiştirilmez. Saydam olmayan fotoğrafların kendi arka
              planı korunur.
            </p>
            <div className="studio-photo-controls">
              <label>
                Kadraj
                <select
                  aria-label="Fotoğraf kadrajı"
                  value={photo.aspect}
                  onChange={(e) =>
                    update({
                      ...photo,
                      aspect: e.target.value as Photography["aspect"],
                    })
                  }
                >
                  <option value="square">Kare · 1:1</option>
                  <option value="portrait">Dikey · 4:5</option>
                  <option value="landscape">Yatay · 4:3</option>
                </select>
              </label>
              <label>
                Arka plan
                <select
                  aria-label="Fotoğraf arka planı"
                  value={photo.background}
                  onChange={(e) =>
                    update({
                      ...photo,
                      background: e.target.value as Photography["background"],
                    })
                  }
                >
                  <option value="dark">Koyu stüdyo</option>
                  <option value="light">Açık stüdyo</option>
                  <option value="original">Mevcut arka plan</option>
                </select>
              </label>
              <label>
                Yerleşim
                <select
                  aria-label="Fotoğraf yerleşimi"
                  value={photo.fit}
                  onChange={(e) =>
                    update({
                      ...photo,
                      fit: e.target.value as Photography["fit"],
                    })
                  }
                >
                  <option value="contain">Ürünün tamamını göster</option>
                  <option value="cover">Kadrajı doldur</option>
                </select>
              </label>
              <label>
                Ortak ölçek · %{photo.scale}
                <input
                  aria-label="Ortak fotoğraf ölçeği"
                  type="range"
                  min="60"
                  max="120"
                  value={photo.scale}
                  onChange={(e) =>
                    update({ ...photo, scale: Number(e.target.value) })
                  }
                />
              </label>
            </div>
            <button
              className="button"
              disabled={busy}
              onClick={() => void action("design")}
            >
              Fotoğraf düzenini taslağa kaydet
            </button>
            <p>
              Genel görünüm, doku ve parlak/mat yüzey çekimlerini gerçek
              fotoğraflarınızla tamamlayın. Yakın çekim otomatik üretilmez.
            </p>
          </section>
          <iframe
            key={data.revision}
            ref={frame}
            title="Ürün fotoğraf düzeni önizlemesi"
            className="studio-photo-preview"
            src="/taslak-onizleme?path=%2Furunler"
            onLoad={() => update(photo)}
          />
        </>
      )}
    </div>
  );
}
