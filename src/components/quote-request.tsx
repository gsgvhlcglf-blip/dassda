"use client";
import { useSiteText } from "./visual-text";
import { useId } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { useVisualCopy, useVisualTranslate } from "@/lib/visual";
import { requestLink } from "@/lib/requests";
import type { Lang } from "@/lib/types";
export function QuoteRequest({
  context = {},
  empty = false,
  home = false,
  lang = "tr",
}: {
  context?: Record<string, string | number | undefined>;
  empty?: boolean;
  home?: boolean;
  lang?: Lang;
}) {
  const fixedText = useSiteText();

  const title = useId(),
    copy = useVisualCopy(lang),
    t = useVisualTranslate(lang);
  return (
    <section
      className={`quote-request ${home ? "home-custom" : "request-options"}${empty ? " quote-request-empty" : ""}`}
      aria-labelledby={title}
    >
      <div className="home-custom-card">
        <div>
          {!home && (
            <p className="eyebrow" data-visual-text={"ui:" + "customCarbon"}>
              {t("customCarbon")}
            </p>
          )}
          <h2 id={title} data-visual-text="slot:home.custom.title">
            {copy("home.custom.title", t("homeCustomTitle"))}
          </h2>
          {empty && (
            <p
              className="quote-empty-note"
              data-visual-text={"slot:copy.quote.elnkenaekkmo"}
            >
              {fixedText("copy.quote.elnkenaekkmo")}
            </p>
          )}
        </div>
        <div className="home-custom-action">
          <p data-visual-text="slot:home.custom.intro">
            {copy("home.custom.intro", t("homeCustomIntro"))}
          </p>
          <Link className="button" href={requestLink("custom", context)}>
            <span data-visual-text="slot:home.custom.action">
              {copy("home.custom.action", t("homeCustomAction"))}
            </span>
            <ArrowUpRight size={16} />
          </Link>
        </div>
      </div>
    </section>
  );
}
