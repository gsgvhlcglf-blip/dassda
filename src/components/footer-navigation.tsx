"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { useVisualTranslate } from "@/lib/visual";
import type { Lang } from "@/lib/types";

export function FooterNavigation({
  lang,
  href,
}: {
  lang: Lang;
  href: (url: string) => string;
}) {
  const t = useVisualTranslate(lang);
  const [open, setOpen] = useState(false);
  const legalId = useId();
  return (
    <nav className="footer-nav" aria-label={t("footerLinks")}>
      <div className="footer-support">
        {[
          ["/sss", "faq"],
          ["/kargo-takip", "tracking"],
        ].map(([url, key]) => (
          <Link key={url} href={href(url)}>
            {t(key as "faq" | "tracking")}
          </Link>
        ))}
      </div>
      <div className="footer-legal-group">
        <button
          className="footer-legal-toggle"
          type="button"
          data-no-editor="true"
          aria-expanded={open}
          aria-controls={legalId}
          onClick={() => setOpen((value) => !value)}
        >
          {t("legalDocuments")}
          <ChevronDown size={16} aria-hidden="true" />
        </button>
        <div className="footer-legal" id={legalId} data-open={open}>
          {[
            ["/gizlilik", "privacyPolicy"],
            ["/mesafeli-satis-sozlesmesi", "distanceSales"],
            ["/on-bilgilendirme-formu", "preInformation"],
            ["/iptal-iade-kosullari", "cancellationReturns"],
            ["/kosullar", "userAgreement"],
          ].map(([url, key]) => (
            <Link key={url} href={href(url)}>
              {t(
                key as
                  | "privacyPolicy"
                  | "distanceSales"
                  | "preInformation"
                  | "cancellationReturns"
                  | "userAgreement",
              )}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
