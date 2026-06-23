"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSelectedDate } from "@/components/date";
import { dayKey } from "@/core/time/day";
import { isDailyAnalysis, type DailyAnalysis } from "@/core/ai/schema";
import {
  useDailyReview,
  useUpsertDailyReview,
  useAnalyzeDay,
  type UpsertReviewInput,
} from "@/hooks/dailyReviews";

/** Idle time after the last keystroke before the journal is auto-saved. */
const DEBOUNCE_MS = 600;

/**
 * Review column: a single free-form journal for the *whole* selected grid day
 * (ADR-004 "Review", PRD). Unlike Plan/Act it shares no time axis — the entry is
 * about the day as a whole, not a clock position — so it draws no hour lines, just
 * one stretching textarea beside the two calendar columns.
 *
 * Input is held in local state and **debounced** (~600ms after typing stops) into
 * the optimistic upsert hook, so the screen never waits on the server
 * (ADR-007 — the textarea is never disabled). A pending save is flushed
 * immediately on blur and when the selected day changes.
 *
 * The "Analyze today" button calls POST /api/daily-reviews/analyze and displays
 * the returned DailyAnalysis (summary · observations · encouragement). The
 * analysis loading is isolated to the AI area — the textarea stays fully
 * interactive during the request (ADR-007, ADR-019, ADR-020).
 */
export function ReviewColumn() {
  const { selectedDate } = useSelectedDate();
  const date = dayKey(selectedDate);
  const { data } = useDailyReview(date);
  const upsert = useUpsertDailyReview();
  const analyze = useAnalyzeDay();

  // Editor text lives locally; the server row only seeds / re-syncs it.
  const [text, setText] = useState("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<UpsertReviewInput | null>(null);
  const mutateRef = useRef(upsert.mutate);
  mutateRef.current = upsert.mutate;

  /** Save the pending write now (if any) and cancel the debounce timer. */
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
        placeholder="How did today go?"
        className="min-h-0 flex-1 w-full resize-none bg-transparent p-3 text-sm leading-relaxed text-foreground placeholder:text-muted focus:outline-none"
      />

      {/* AI analysis area — isolated so its loading never blocks the textarea */}
      <div className="border-t border-grid p-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted">AI Review</span>
          <button
            type="button"
            onClick={() => analyze.mutate({ date })}
            disabled={analyze.isPending}
            className="rounded px-2 py-1 text-xs font-medium text-accent transition-colors hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-50"
          >
            {analyze.isPending ? "Analyzing…" : analysis ? "Re-analyze" : "Analyze today"}
          </button>
        </div>

        {analyze.isError && (
          <p className="text-xs text-red-500">
            {analyze.error?.message ?? "Analysis failed. Try again."}
          </p>
        )}

        {analysis && (
          <div className="space-y-2 text-sm">
            <p className="font-medium text-foreground">{analysis.summary}</p>

            {analysis.observations.length > 0 && (
              <ul className="space-y-0.5 text-muted">
                {analysis.observations.map((obs, i) => (
                  <li key={i} className="flex gap-1.5">
                    <span className="mt-0.5 shrink-0">·</span>
                    <span>{obs}</span>
                  </li>
                ))}
              </ul>
            )}

            <p className="text-muted italic">{analysis.encouragement}</p>

            {analysis.generatedAt && (
              <p className="text-xs text-muted opacity-60">
                {new Date(analysis.generatedAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
