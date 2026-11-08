"use client";
import { useState } from "react";
import Link from "next/link";
import { privacyPreference } from "@/lib/analytics-recorder";
import { saveCookieChoice, useCookieChoice } from "@/lib/cookie-consent";
export function CookieNotice() {
  const { choice, ready } = useCookieChoice();
  const [open, setOpen] = useState(false),
    [preferences, setPreferences] = useState(false),
    [analytics, setAnalytics] = useState(false),
    [feedback, setFeedback] = useState("");
  const blocked = ready && privacyPreference();
  function choose(value: boolean) {
    const persisted = saveCookieChoice(value && !blocked);
    setFeedback(
      persisted
        ? ""
        : "Tercihin bu ziyaret için uygulandı. Tarayıcın kalıcı kayda izin vermiyor.",
    );
    setOpen(false);
    setPreferences(false);
  }
  function manage() {
    setAnalytics(choice?.analytics === true && !blocked);
    setPreferences(true);
    setOpen(true);
  }
  if (!ready) return null;
  return (
    <div data-no-analytics data-no-editor className="cookie-consent-controls">
      <button
        type="button"
        className="cookie-preferences under-link"
        onClick={manage}
      >
        Çerez tercihleri
      </button>
      {feedback && (
        <p role="status" className="cookie-feedback">
          {feedback}
        </p>
      )}
      {(!choice || open) && (
        <section
          className="cookie-notice"
          role="region"
          aria-label="Çerez bildirimi"
        >
          <h2>
            {preferences ? "Çerez tercihlerini yönet" : "Çerez tercihlerin"}
          </h2>
          <p>
            Sepet, oturum ve tercihlerini hatırlamak için gerekli çerezler ve
            tarayıcı depolaması kullanılır. Onayınla ziyaret, tıklama ve
            kaydırma verilerini istatistik ve ısı haritası için kaydederiz.
            Formlara yazdığın bilgiler analitik kaydına alınmaz. İsteğe bağlı
            analizi reddederek de siteyi kullanabilirsin.
          </p>
          {blocked && (
            <p role="status">
              Tarayıcının gizlilik tercihi (DNT / GPC) nedeniyle isteğe bağlı
              analiz kapalı tutulur.
            </p>
          )}
          {preferences && (
            <div className="cookie-categories">
              <label>
                <span>
                  <b>Gerekli depolama</b>
                  <small>
                    Sepet, güvenli oturum ve tercih kaydı için gereklidir. Her
                    zaman açıktır.
                  </small>
                </span>
                <input
                  type="checkbox"
                  checked
                  disabled
                  aria-label="Gerekli depolama"
                />
              </label>
              <label>
                <span>
                  <b>İstatistik ve ısı haritası</b>
                  <small>
                    Sayfa ziyaretleri, tıklama konumları ve kaydırma derinliği.
                    Yalnızca iznin varsa ve site yöneticisi analizi
                    etkinleştirmişse çalışır.
                  </small>
                </span>
                <input
                  type="checkbox"
                  checked={analytics && !blocked}
                  disabled={blocked}
                  onChange={(e) => setAnalytics(e.target.checked)}
                  aria-label="İstatistik ve ısı haritası"
                />
              </label>
              <p>
                Bu seçim bu ziyaret için geçerlidir. Siteye her yeni girişte ve
                sayfa yenilendiğinde bildirim yeniden açılır; önceki kabul
                otomatik izin sayılmaz. Alt bilgideki “Çerez tercihleri”
                bağlantısından iznini geri çekebilirsin. Reklam ve pazarlama
                çerezleri kullanılmaz.
              </p>
            </div>
          )}
          <div className="cookie-actions">
            <button
              type="button"
              className="button secondary"
              disabled={blocked}
              onClick={() => choose(true)}
            >
              Kabul et
            </button>
            <button
              type="button"
              className="button secondary"
              onClick={() => choose(false)}
            >
              Reddet
            </button>
            {preferences ? (
              <button
                type="button"
                className="button"
                onClick={() => choose(analytics)}
              >
                Tercihleri kaydet
              </button>
            ) : (
              <button type="button" className="under-link" onClick={manage}>
                Tercihleri yönet
              </button>
            )}
            {choice && open && (
              <button
                type="button"
                className="under-link"
                onClick={() => setOpen(false)}
              >
                Kapat
              </button>
            )}
            <Link className="under-link" href="/gizlilik">
              Gizlilik politikası
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
