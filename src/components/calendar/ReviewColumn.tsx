"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSelectedDate } from "@/components/date";
import { dayKey } from "@/core/time/day";
import { isDailyAnalysis, type DailyAnalysis } from "@/core/ai/schema";
import {
  useDailyReview,
  useUpsertDailyReview,
  type UpsertReviewInput,
} from "@/hooks/dailyReviews";
import { useTranslations } from "@/i18n/context";

/** Idle time after the last keystroke before the journal is auto-saved. */
const DEBOUNCE_MS = 600;

/**
 * Review column: a single free-form journal for the *whole* selected grid day
 * (ADR-004 "Review", PRD). Unlike Plan/Act it shares no time axis.
 *
 * Input is debounced (~600ms) into the optimistic upsert hook (ADR-007).
 * Pending saves are flushed on blur and on day change.
 *
 * AI analysis is triggered from the header "Analyze today" button (ADR-020).
 * When ai_analysis exists on the review row, it is shown below the journal in
 * a visually distinct area (accent-tinted background). The textarea is never
 * disabled — analysis loading is fully decoupled (ADR-007).
 */
export function ReviewColumn() {
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
    ? data.aiAnalysis
    : null;

  return (
    <div className="flex flex-1 flex-col border-l border-grid">
      <textarea
        value={text}
        onChange={handleChange}
        onBlur={flush}
        placeholder={t("placeholder")}
        className="min-h-0 flex-1 w-full resize-none bg-transparent p-3 text-sm leading-relaxed text-foreground placeholder:text-muted focus:outline-none"
      />

      {analysis && <AnalysisResult analysis={analysis} />}
    </div>
  );
}

function AnalysisResult({ analysis }: { analysis: DailyAnalysis }) {
  return (
    <div className="border-t border-grid bg-accent-soft/40 p-3 space-y-2 text-sm">
      <p className="font-semibold text-accent">{analysis.summary}</p>

      {analysis.observations.length > 0 && (
        <ul className="space-y-0.5 text-foreground/80">
          {analysis.observations.map((obs, i) => (
            <li key={i} className="flex gap-1.5">
              <span className="mt-0.5 shrink-0 text-accent">·</span>
              <span>{obs}</span>
            </li>
          ))}
        </ul>
      )}

      <p className="italic text-foreground/70">{analysis.encouragement}</p>

      {analysis.generatedAt && (
        <p className="text-xs text-muted">
          {new Date(analysis.generatedAt).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      )}
    </div>
  );
}
