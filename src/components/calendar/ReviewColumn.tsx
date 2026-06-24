"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSelectedDate } from "@/components/date";
import { dayKey } from "@/core/time/day";
import { isDailyAnalysis, type DailyAnalysis, type TaskRatio } from "@/core/ai/schema";
import {
  useDailyReview,
  useUpsertDailyReview,
  type UpsertReviewInput,
} from "@/hooks/dailyReviews";
import { AnalyzeButton } from "@/components/AnalyzeButton";
import { useLocale, useTranslations } from "next-intl";

/** Idle time after the last keystroke before the journal is auto-saved. */
const DEBOUNCE_MS = 600;

/**
 * Review column: a single free-form journal for the *whole* selected grid day
 * (ADR-004 "Review", PRD). Unlike Plan/Act it shares no time axis.
 *
 * Input is debounced (~600ms) into the optimistic upsert hook (ADR-007).
 * Pending saves are flushed on blur and on day change.
 *
 * AI analysis is triggered from the Analyze button at the foot of this panel
 * (ADR-020), so the trigger sits beside its result. When ai_analysis exists on
 * the review row, it is shown below the journal in a visually distinct area
 * (accent-tinted background). The textarea is never disabled — analysis loading
 * is fully decoupled (ADR-007).
 */
export function ReviewColumn({ className }: { className?: string }) {
  const t = useTranslations("review");
  const { selectedDate } = useSelectedDate();
  const date = dayKey(selectedDate);
  const { data } = useDailyReview(date);
  const upsert = useUpsertDailyReview();

  const [text, setText] = useState("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<UpsertReviewInput | null>(null);
  const mutateRef = useRef(upsert.mutate);
  mutateRef.current = upsert.mutate;

  const flush = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const pending = pendingRef.current;
    if (pending) {
      mutateRef.current(pending);
      pendingRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (pendingRef.current?.date === date) return;
    setText(data?.journalText ?? "");
  }, [date, data?.journalText]);

  const prevDateRef = useRef(date);
  useEffect(() => {
    if (prevDateRef.current !== date) {
      flush();
      prevDateRef.current = date;
    }
  }, [date, flush]);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const journalText = e.target.value;
    setText(journalText);
    pendingRef.current = { date, journalText };
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(flush, DEBOUNCE_MS);
  };

  // Safely narrow the jsonb blob — unknown shape must never crash the render.
  const analysis: DailyAnalysis | null = isDailyAnalysis(data?.aiAnalysis)
    ? (data!.aiAnalysis as DailyAnalysis)
    : null;

  return (
    <div className={`flex flex-1 flex-col border-l border-grid${className ? ` ${className}` : ""}`}>
      <textarea
        value={text}
        onChange={handleChange}
        onBlur={flush}
        placeholder={t("placeholder")}
        className="min-h-0 flex-1 w-full resize-none bg-transparent p-3 text-sm leading-relaxed text-foreground placeholder:text-muted focus:outline-none"
      />

      {analysis && <AnalysisResult analysis={analysis} />}

      <AnalyzeButton />
    </div>
  );
}

function AnalysisResult({ analysis }: { analysis: DailyAnalysis }) {
  const locale = useLocale();
  const t = useTranslations("review");
  return (
    <div className="mx-2 mb-2 rounded-lg border border-accent/20 bg-accent-soft/50 p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-1.5">
        <span className="text-xs font-semibold uppercase tracking-wider text-accent">
          ✦ {t("aiHeader")}
        </span>
        {analysis.generatedAt && (
          <span className="ml-auto text-[10px] text-muted tabular-nums">
            {new Date(analysis.generatedAt).toLocaleTimeString(locale, {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        )}
      </div>

      {/* Today's Pattern */}
      <div className="space-y-1">
        <p className="text-xs font-semibold text-foreground">{t("todaysPattern")}</p>
        <p className="text-xs leading-relaxed text-foreground/80">{analysis.summary}</p>
      </div>

      {/* Est → Actual chips */}
      {analysis.taskRatios && analysis.taskRatios.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-foreground">{t("estVsActual")}</p>
          <div className="flex flex-wrap gap-1.5">
            {analysis.taskRatios.map((r: TaskRatio, i: number) => (
              <div
                key={i}
                className="flex items-center gap-1 rounded bg-accent/10 px-2 py-0.5 text-[11px] tabular-nums"
              >
                <span className="text-muted">{r.name}</span>
                <span className="font-medium text-accent">
                  {r.estimated} → {r.actual}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Suggestions */}
      {analysis.observations.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-semibold text-foreground">{t("suggestions")}</p>
          <ul className="space-y-1">
            {analysis.observations.map((obs: string, i: number) => (
              <li key={i} className="flex gap-1.5 text-xs leading-relaxed text-foreground/80">
                <span className="mt-0.5 shrink-0 text-accent">•</span>
                <span>{obs}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Encouragement */}
      {analysis.encouragement && (
        <p className="text-xs italic text-foreground/60">{analysis.encouragement}</p>
      )}
    </div>
  );
}
