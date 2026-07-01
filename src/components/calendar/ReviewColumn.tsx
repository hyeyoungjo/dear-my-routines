"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSelectedDate } from "@/components/date";
import { dayKey } from "@/core/time/day";
import {
  useDailyReview,
  useUpsertDailyReview,
  type UpsertReviewInput,
} from "@/hooks/dailyReviews";
import { useTranslations } from "next-intl";

/** Idle time after the last keystroke before the journal is auto-saved. */
const DEBOUNCE_MS = 600;

/**
 * Review column: a single free-form journal for the *whole* selected grid day
 * (ADR-004 "Review", PRD). Unlike Plan/Act it shares no time axis.
 *
 * Input is debounced (~600ms) into the optimistic upsert hook (ADR-007).
 * Pending saves are flushed on blur and on day change.
 *
 * Just the journal now: the AI analysis trigger + read-out moved to its own
 * toggleable side panel (AiPanel, the mirror of the Shelf), so Plan/Act/Reflect
 * stay purely what the user does (ADR-020).
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

  return (
    <div className={`flex flex-1 flex-col border-l border-grid${className ? ` ${className}` : ""}`}>
      <textarea
        value={text}
        onChange={handleChange}
        onBlur={flush}
        placeholder={t("placeholder")}
        className="min-h-0 flex-1 w-full resize-none bg-transparent p-3 text-sm leading-relaxed text-foreground placeholder:text-muted focus:outline-none"
      />
    </div>
  );
}
