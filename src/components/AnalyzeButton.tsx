"use client";

import { useSelectedDate } from "@/components/date";
import { dayKey } from "@/core/time/day";
import { isDailyAnalysis } from "@/core/ai/schema";
import { useAnalyzeDay, useDailyReview } from "@/hooks/dailyReviews";
import { useUserSettings } from "@/hooks/userSettings";

/**
 * Analyze control that lives at the foot of the review panel (ADR-020), so the
 * trigger sits next to where its result renders. Self-gating: renders nothing
 * unless the user may run AI analysis. Reads the day's review (shared query
 * cache) to label itself "Re-analyze" once an analysis already exists.
 */
export function AnalyzeButton() {
  const { data: settings } = useUserSettings();
  const { selectedDate } = useSelectedDate();
  const date = dayKey(selectedDate);
  const analyze = useAnalyzeDay();
  const { data: review } = useDailyReview(date);

  const role = settings?.role ?? "user";
  const canAnalyze = role === "admin" || role === "tester" || settings?.aiEnabled;
  if (!canAnalyze) return null;

  const hasAnalysis = isDailyAnalysis(review?.aiAnalysis);
  const label = analyze.isPending
    ? "Analyzing…"
    : hasAnalysis
      ? "Re-analyze"
      : "Analyze today";

  return (
    <div className="flex justify-end border-t border-grid p-2">
      <button
        type="button"
        onClick={() => analyze.mutate({ date })}
        disabled={analyze.isPending}
        className="rounded-md px-2.5 py-1 text-xs font-medium text-accent transition-colors hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-50"
      >
        {label}
      </button>
    </div>
  );
}
