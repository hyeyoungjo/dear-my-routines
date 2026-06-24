"use client";

import { useSelectedDate } from "@/components/date";
import { dayKey } from "@/core/time/day";
import { isDailyAnalysis } from "@/core/ai/schema";
import { useAnalyzeDay, useDailyReview } from "@/hooks/dailyReviews";
import { useUserSettings } from "@/hooks/userSettings";
import { useTranslations } from "next-intl";

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

  const t = useTranslations("review");
  const role = settings?.role ?? "user";
  const canAnalyze = role === "admin" || role === "tester" || settings?.aiEnabled;
  if (!canAnalyze) return null;

  const hasAnalysis = isDailyAnalysis(review?.aiAnalysis);
  const label = analyze.isPending
    ? t("analyzing")
    : hasAnalysis
      ? t("reanalyze")
      : t("analyzeToday");

  return (
    <div className="p-2">
      <button
        type="button"
        onClick={() => analyze.mutate({ date })}
        disabled={analyze.isPending}
        className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-accent/35 py-2 text-xs font-medium text-accent transition-colors hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className={analyze.isPending ? "animate-spin" : ""}>✦</span>
        {label}
      </button>
    </div>
  );
}
