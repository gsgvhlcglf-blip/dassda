"use client";
import { useState } from "react";
import {
  validateHeroVideoFile,
  validateBrowserVideo,
  type HeroVideoAsset,
} from "@/lib/hero-video";
export function HeroVideoSettings({
  value,
  onSave,
}: {
  value?: HeroVideoAsset;
  onSave: (video: HeroVideoAsset | null) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function upload(file: File) {
    setBusy(true);
    setError("");
    try {
      await validateHeroVideoFile(file);
      await validateBrowserVideo(file);
      const body = new FormData();
      body.set("file", file);
      const response = await fetch("/api/upload-video", {
        method: "POST",
        body,
      });
      const data = await response.json();
      if (!response.ok) throw Error(data.error || "Video yüklenemedi.");
      await onSave(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Video kaydedilemedi.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="analytics-card">
      <h3>Ana sayfa banner videosu</h3>
      <p>
        MP4 (H.264) veya WebM · En fazla 50 MB. Video sessiz ve döngüde oynar;
        mevcut banner fotoğrafı yedek görsel olarak kalır.
      </p>
      <label>
        Banner videosu yükle
        <input
          type="file"
          accept="video/mp4,video/webm"
          disabled={busy}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void upload(file);
          }}
        />
      </label>
      {value && (
        <>
          <p>{value.name}</p>
          <button
            type="button"
            className="button secondary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onSave(null);
                setError("");
              } catch (e) {
                setError(e instanceof Error ? e.message : "Kaydedilemedi.");
              } finally {
                setBusy(false);
              }
            }}
          >
            Videoyu kaldır, fotoğrafı kullan
          </button>
        </>
      )}
      {busy && <p role="status">Video kaydediliyor…</p>}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <p>Taslağı önizleyip Yayın & sürümler bölümünden yayınlayın.</p>
    </section>
  );
}
