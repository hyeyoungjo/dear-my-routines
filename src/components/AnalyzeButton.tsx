"use client";

import { useSelectedDate } from "@/components/date";
import { dayKey } from "@/core/time/day";
import { useAnalyzeDay } from "@/hooks/dailyReviews";

/** "Analyze today" button in the header — triggers AI analysis for the selected date. */
export function AnalyzeButton() {
  const { selectedDate } = useSelectedDate();
  const date = dayKey(selectedDate);
  const analyze = useAnalyzeDay();

  return (
    <button
      type="button"
      onClick={() => analyze.mutate({ date })}
      disabled={analyze.isPending}
      className="rounded-md px-2 py-1.5 text-xs font-medium text-muted transition-colors hover:bg-accent-soft hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
    >
      {analyze.isPending ? "Analyzing…" : "Analyze today"}
    </button>
  );
}
