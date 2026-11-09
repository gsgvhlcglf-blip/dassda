"use client";
import { VisualText, useSiteText } from "./visual-text";
import { useState } from "react";
import Link from "next/link";
import { privacyPreference } from "@/lib/analytics-recorder";
import { saveCookieChoice, useCookieChoice } from "@/lib/cookie-consent";
export function CookieNotice() {
  const fixedText = useSiteText();

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
        data-visual-text={"slot:copy.cookie.nknbhplnipga"}
      >
        {fixedText("copy.cookie.nknbhplnipga")}
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
          aria-label={fixedText("copy.cookie.chjfgeglamhb")}
        >
          <h2>
            {preferences ? (
              <VisualText textKey={"slot:copy.cookie.iajaaoafmbjm"} />
            ) : (
              <VisualText textKey={"slot:copy.cookie.kdmaadjagpjg"} />
            )}
          </h2>
          <p data-visual-text={"slot:copy.cookie.hommmdiikecn"}>
            {fixedText("copy.cookie.hommmdiikecn")}
          </p>
          {blocked && (
            <p role="status" data-visual-text={"slot:copy.cookie.lmbaeklpejhp"}>
              {fixedText("copy.cookie.lmbaeklpejhp")}
            </p>
          )}
          {preferences && (
            <div className="cookie-categories">
              <label>
                <span>
                  <b data-visual-text={"slot:copy.cookie.cegnlgalncml"}>
                    {fixedText("copy.cookie.cegnlgalncml")}
                  </b>
                  <small data-visual-text={"slot:copy.cookie.ngkeejdcadok"}>
                    {fixedText("copy.cookie.ngkeejdcadok")}
                  </small>
                </span>
                <input
                  type="checkbox"
                  checked
                  disabled
                  aria-label={fixedText("copy.cookie.cegnlgalncml")}
                />
              </label>
              <label>
                <span>
                  <b data-visual-text={"slot:copy.cookie.ldehimblhnjg"}>
                    {fixedText("copy.cookie.ldehimblhnjg")}
                  </b>
                  <small data-visual-text={"slot:copy.cookie.ahjmdjnfggpa"}>
                    {fixedText("copy.cookie.ahjmdjnfggpa")}
                  </small>
                </span>
                <input
                  type="checkbox"
                  checked={analytics && !blocked}
                  disabled={blocked}
                  onChange={(e) => setAnalytics(e.target.checked)}
                  aria-label={fixedText("copy.cookie.ldehimblhnjg")}
                />
              </label>
              <p data-visual-text={"slot:copy.cookie.lnaakaehboao"}>
                {fixedText("copy.cookie.lnaakaehboao")}
              </p>
            </div>
          )}
          <div className="cookie-actions">
            <button
              type="button"
              className="button secondary"
              disabled={blocked}
              onClick={() => choose(true)}
              data-visual-text={"slot:copy.cookie.efidadjehgno"}
            >
              {fixedText("copy.cookie.efidadjehgno")}
            </button>
            <button
              type="button"
              className="button secondary"
              onClick={() => choose(false)}
              data-visual-text={"slot:copy.cookie.enodnkabjbhk"}
            >
              {fixedText("copy.cookie.enodnkabjbhk")}
            </button>
            {preferences ? (
              <button
                type="button"
                className="button"
                onClick={() => choose(analytics)}
                data-visual-text={"slot:copy.cookie.fnoaebndjioj"}
              >
                {fixedText("copy.cookie.fnoaebndjioj")}
              </button>
            ) : (
              <button
                type="button"
                className="under-link"
                onClick={manage}
                data-visual-text={"slot:copy.cookie.hechlogifgko"}
              >
                {fixedText("copy.cookie.hechlogifgko")}
              </button>
            )}
            {choice && open && (
              <button
                type="button"
                className="under-link"
                onClick={() => setOpen(false)}
                data-visual-text={"slot:copy.cookie.dogiepolnbkn"}
              >
                {fixedText("copy.cookie.dogiepolnbkn")}
              </button>
            )}
            <Link
              className="under-link"
              href="/gizlilik"
              data-visual-text={"slot:copy.cookie.jplhlgifpcdg"}
            >
              {fixedText("copy.cookie.jplhlgifpcdg")}
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
