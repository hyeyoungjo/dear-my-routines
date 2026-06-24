"use client";

import { useSelectedDate } from "@/components/date";
import { dayKey } from "@/core/time/day";
import { useAnalyzeDay } from "@/hooks/dailyReviews";
import { useUserSettings } from "@/hooks/userSettings";

/** "Analyze today" button — only renders when the user has enabled AI analysis. */
export function AnalyzeButton() {
  const { data: settings } = useUserSettings();
  const { selectedDate } = useSelectedDate();
  const date = dayKey(selectedDate);
  const analyze = useAnalyzeDay();

  const role = settings?.role ?? "user";
  const canAnalyze = role === "admin" || role === "tester" || settings?.aiEnabled;
  if (!canAnalyze) return null;

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
