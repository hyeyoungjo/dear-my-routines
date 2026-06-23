"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSelectedDate } from "@/components/date";
import { dayKey } from "@/core/time/day";
import {
  useDailyReview,
  useUpsertDailyReview,
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
 * the optimistic upsert hook (Step 1), so the screen never waits on the server
 * (ADR-007 — the textarea is never disabled). A pending save is flushed
 * immediately on blur and when the selected day changes, because a debounce timer
 * still ticking when the user navigates away would otherwise drop the last edit.
 * The timer is cleared on unmount to avoid a duplicate save / leak.
 *
 * AI analysis (`ai_analysis`) is out of scope this phase — no buttons, no results.
 */
export function ReviewColumn() {
  const { selectedDate } = useSelectedDate();
  const date = dayKey(selectedDate);
  const { data } = useDailyReview(date);
  const upsert = useUpsertDailyReview();

  // Editor text lives locally; the server row only seeds / re-syncs it.
  const [text, setText] = useState("");
  // The debounce timer and the not-yet-saved write (tagged with its own date so a
  // flush triggered by a day change still saves to the day it was typed for).
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<UpsertReviewInput | null>(null);
  // Mirror the latest mutate so the stable `flush` never closes over a stale one.
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

  // Seed (or re-sync) the editor from the server row when switching days or when
  // a day's review first arrives — but never clobber unsaved local edits for the
  // day currently being typed (pending write still queued for this date).
  useEffect(() => {
    if (pendingRef.current?.date === date) return;
    setText(data?.journalText ?? "");
  }, [date, data?.journalText]);

  // On day change, flush the previous day's pending write before the seed effect
  // above swaps in the new day's text — otherwise a mid-debounce nav loses it.
  const prevDateRef = useRef(date);
  useEffect(() => {
    if (prevDateRef.current !== date) {
      flush();
      prevDateRef.current = date;
    }
  }, [date, flush]);

  // Clear the timer on unmount (no duplicate save, no leak).
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
    <div className="flex flex-1 flex-col border-l border-grid">
      <textarea
        value={text}
        onChange={handleChange}
        onBlur={flush}
        placeholder="How did today go?"
        className="h-full w-full resize-none bg-transparent p-3 text-sm leading-relaxed text-foreground placeholder:text-muted focus:outline-none"
      />
    </div>
  );
}
