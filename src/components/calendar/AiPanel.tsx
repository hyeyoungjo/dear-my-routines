"use client";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faWandMagicSparkles } from "@fortawesome/free-solid-svg-icons";
import { useSelectedDate } from "@/components/date";
import { dayKey } from "@/core/time/day";
import { isDailyAnalysis, type DailyAnalysis, type TaskRatio } from "@/core/ai/schema";
import { useDailyReview } from "@/hooks/dailyReviews";
import { AnalyzeButton } from "@/components/AnalyzeButton";
import { useLocale, useTranslations } from "next-intl";

/**
 * The AI panel (ADR-020): the daily review's Analyze / Re-analyze trigger and its
 * result, lifted out of the Reflect column into its own toggleable side panel —
 * the mirror of the Shelf. Plan / Act / Reflect are what the user does; the AI
 * read-out is a separate, opt-in surface. Self-contained like ShelfColumn.
 */
export function AiPanel() {
  const t = useTranslations("review");
  const { selectedDate } = useSelectedDate();
  const date = dayKey(selectedDate);
  const { data } = useDailyReview(date);
  const analysis: DailyAnalysis | null = isDailyAnalysis(data?.aiAnalysis)
    ? (data!.aiAnalysis as DailyAnalysis)
    : null;

  return (
    <div className="flex min-h-0 flex-col">
      <div className="mb-3 flex items-baseline gap-1.5">
        <h2 className="text-base font-semibold tracking-tight text-foreground">
          <FontAwesomeIcon icon={faWandMagicSparkles} className="mr-1.5 text-sm text-accent" />
          {t("aiHeader")}
        </h2>
      </div>

      <AnalyzeButton />

      {analysis ? (
        <AnalysisResult analysis={analysis} />
      ) : (
        <p className="px-2 pt-2 text-xs leading-relaxed text-muted">{t("aiEmpty")}</p>
      )}
    </div>
  );
}

function AnalysisResult({ analysis }: { analysis: DailyAnalysis }) {
  const locale = useLocale();
  const t = useTranslations("review");
  return (
    <div className="mt-2 rounded-lg border border-accent/20 bg-accent-soft/50 p-3 space-y-3">
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
                {r.isDeferred || r.actual === "—" ? (
                  <>
                    <span className="font-medium text-accent">{r.estimated}</span>
                    <span className="rounded bg-muted/20 px-1 py-px text-[10px] font-medium text-muted">
                      {t("deferred")}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="font-medium text-accent">
                      {r.estimated} → {r.actual}
                    </span>
                    {r.isPartial && (
                      <span className="rounded bg-accent/20 px-1 py-px text-[10px] font-medium text-accent">
                        {t("continuesTomorrow")}
                      </span>
                    )}
                  </>
                )}
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
