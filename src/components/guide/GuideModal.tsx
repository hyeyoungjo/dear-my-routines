"use client";

import { useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faXmark } from "@fortawesome/free-solid-svg-icons";
import { useLocale, useTranslations } from "next-intl";
import { CHANGELOG } from "@/lib/changelog";
import { InterfaceDiagram } from "@/components/guide/InterfaceDiagram";
import { FlowDiagram } from "@/components/guide/FlowDiagram";
import type { LanguageId } from "@/lib/languages";

/**
 * The guide as a closable window (opened from the header ? button): the interface
 * mock, the workflow flow, and the what's-new changelog. Escape or the ✕ / backdrop
 * closes it. Marking the changelog seen (the "new" dot) is the button's job.
 */
export function GuideModal({ onClose }: { onClose: () => void }) {
  const t = useTranslations("guide");
  const locale = useLocale();
  const loc: LanguageId = locale === "ko" ? "ko" : "en";

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("title")}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-border bg-background text-foreground shadow-lg"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 className="text-base font-semibold tracking-tight">{t("title")}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("close")}
            title={t("close")}
            className="rounded-md px-1 text-muted transition-colors hover:bg-accent-soft hover:text-foreground"
          >
            <FontAwesomeIcon icon={faXmark} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-10 overflow-y-auto px-5 py-6">
          {/* 1. Interface */}
          <section>
            <h3 className="mb-4 text-lg font-semibold tracking-tight">
              {t("interface.heading")}
            </h3>
            <div className="rounded-xl border border-border p-3">
              <InterfaceDiagram
                labels={{
                  settings: t("interface.settings"),
                  shelf: t("interface.shelf"),
                  plan: t("interface.plan"),
                  act: t("interface.act"),
                  reflect: t("interface.reflect"),
                  timeline: t("interface.timeline"),
                }}
              />
            </div>
          </section>

          {/* 2. Workflow */}
          <section>
            <h3 className="mb-4 text-lg font-semibold tracking-tight">
              {t("flow.heading")}
            </h3>
            <div className="rounded-xl border border-border p-3">
              <FlowDiagram
                labels={{
                  optional: t("flow.optional"),
                  project: {
                    label: t("flow.project.label"),
                    desc: t("flow.project.desc"),
                  },
                  plan: { label: t("flow.plan.label"), desc: t("flow.plan.desc") },
                  act: { label: t("flow.act.label"), desc: t("flow.act.desc") },
                  reflect: {
                    label: t("flow.reflect.label"),
                    desc: t("flow.reflect.desc"),
                  },
                }}
              />
            </div>
          </section>

          {/* 3. What's new */}
          <section>
            <h3 className="mb-3 text-lg font-semibold tracking-tight">
              {t("whatsNew")}
            </h3>
            <div className="flex flex-col gap-5">
              {CHANGELOG.map((entry) => (
                <article
                  key={entry.date}
                  className="rounded-xl border border-border bg-panel p-4"
                >
                  <div className="mb-2 flex items-baseline justify-between gap-2">
                    <h4 className="text-sm font-semibold">
                      {entry.content[loc].title}
                    </h4>
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
        </div>
      </div>
    </div>
  );
}
