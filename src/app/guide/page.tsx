"use client";

import { useEffect } from "react";
import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowLeft } from "@fortawesome/free-solid-svg-icons";
import { useLocale, useTranslations } from "next-intl";
import { CHANGELOG, LATEST_CHANGELOG_DATE } from "@/lib/changelog";
import { GUIDE_SEEN_KEY } from "@/components/GuideButton";
import type { LanguageId } from "@/lib/languages";

/**
 * In-app guide (protected route — see middleware): basic usage + a what's-new
 * changelog. Opening it marks the latest changelog date as seen, clearing the
 * "new" dot on the header button. Distinct from the login landing page.
 */
export default function GuidePage() {
  const t = useTranslations("guide");
  const locale = useLocale();
  const loc: LanguageId = locale === "ko" ? "ko" : "en";

  useEffect(() => {
    localStorage.setItem(GUIDE_SEEN_KEY, LATEST_CHANGELOG_DATE);
  }, []);

  const steps = [
    { title: t("step1Title"), body: t("step1Body") },
    { title: t("step2Title"), body: t("step2Body") },
    { title: t("step3Title"), body: t("step3Body") },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="flex items-center gap-3 border-b border-border bg-panel px-4 py-3 sm:px-6">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-md px-2 py-1 text-sm text-muted transition-colors hover:bg-accent-soft hover:text-foreground"
        >
          <FontAwesomeIcon icon={faArrowLeft} />
          {t("back")}
        </Link>
        <h1 className="text-base font-semibold tracking-tight">{t("title")}</h1>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 space-y-10 px-4 py-8">
        {/* How to use */}
        <section>
          <h2 className="mb-1 text-lg font-semibold tracking-tight">{t("howTo")}</h2>
          <p className="mb-4 text-sm text-muted">{t("intro")}</p>
          <ol className="flex flex-col gap-3">
            {steps.map((s, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-white">
                  {i + 1}
                </span>
                <span className="text-sm leading-relaxed">
                  <span className="font-semibold">{s.title}</span>
                  {" — "}
                  <span className="text-muted">{s.body}</span>
                </span>
              </li>
            ))}
          </ol>
        </section>

        {/* What's new */}
        <section>
          <h2 className="mb-3 text-lg font-semibold tracking-tight">
            {t("whatsNew")}
          </h2>
          <div className="flex flex-col gap-5">
            {CHANGELOG.map((entry) => (
              <article
                key={entry.date}
                className="rounded-xl border border-border bg-panel p-4"
              >
                <div className="mb-2 flex items-baseline justify-between gap-2">
                  <h3 className="text-sm font-semibold">
                    {entry.content[loc].title}
                  </h3>
                  <time className="shrink-0 text-xs tabular-nums text-muted">
                    {entry.date}
                  </time>
                </div>
                <ul className="flex flex-col gap-1.5">
                  {entry.content[loc].items.map((item, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 text-sm leading-relaxed text-muted"
                    >
                      <span className="mt-1.5 size-1 shrink-0 rounded-full bg-accent" />
                      {item}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
