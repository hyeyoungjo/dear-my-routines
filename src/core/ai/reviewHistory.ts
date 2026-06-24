import type { ExportRow } from "@/core/export";
import { formatMinutes } from "./dailyReviewPrompt";

/**
 * Trailing-window history for the daily AI review.
 *
 * The single-day review is blind to the patterns this app exists to surface —
 * chronic under-estimation and chronically deferred tasks only show up *across*
 * days. This module condenses a trailing window of already-computed `ExportRow`
 * facts (planned vs. actual, completion status, carry-over count) into a short,
 * scannable block the prompt can include without ballooning. It is a pure
 * function so it stays testable and reusable (CLAUDE.md: logic lives in core/).
 */

/** Default trailing window when the user has not set one. */
export const REVIEW_HISTORY_DAYS_DEFAULT = 14;
/** Hard bounds (performance + meaningfulness); the setting is clamped to this. */
export const REVIEW_HISTORY_DAYS_MIN = 1;
export const REVIEW_HISTORY_DAYS_MAX = 30;

/** Clamp a user-supplied window to [MIN, MAX], falling back to the default. */
export function clampHistoryDays(value: number | null | undefined): number {
  if (value == null || !Number.isFinite(value)) return REVIEW_HISTORY_DAYS_DEFAULT;
  return Math.max(
    REVIEW_HISTORY_DAYS_MIN,
    Math.min(REVIEW_HISTORY_DAYS_MAX, Math.round(value)),
  );
}

/** Per-task roll-up over the window — the unit both pattern lists are built from. */
type TaskRollup = {
  taskName: string;
  projectName: string;
  completedDays: number;
  plannedSum: number;
  actualSum: number;
  deferredDays: number;
  /** Largest carry-over count seen — proxy for the current deferral streak. */
  maxCarriedOver: number;
};

/** Only flag under-estimation once it is real, not rounding noise. */
const UNDERESTIMATE_RATIO = 1.5;
const MIN_COMPLETED_DAYS = 2;
const MIN_DEFERRED_SIGNAL = 2;
const TOP_N = 5;

function rollUpByTask(rows: ExportRow[]): TaskRollup[] {
  const byTask = new Map<string, TaskRollup>();
  for (const r of rows) {
    const key = `${r.task_name}|${r.project_name}`;
    let t = byTask.get(key);
    if (!t) {
      t = {
        taskName: r.task_name,
        projectName: r.project_name,
        completedDays: 0,
        plannedSum: 0,
        actualSum: 0,
        deferredDays: 0,
        maxCarriedOver: 0,
      };
      byTask.set(key, t);
    }
    if (r.completion_status === "deferred") {
      t.deferredDays += 1;
    } else if (r.actual_duration_min != null && r.planned_duration_min != null) {
      // Only days with both a plan and a completed action inform estimation.
      t.completedDays += 1;
      t.plannedSum += r.planned_duration_min;
      t.actualSum += r.actual_duration_min;
    }
    t.maxCarriedOver = Math.max(t.maxCarriedOver, r.times_carried_over);
  }
  return [...byTask.values()];
}

/** Task context suffix, e.g. ` (Talk2Sketch)` — omitted when there is no project. */
function projectSuffix(projectName: string): string {
  return projectName && projectName !== "No project" ? ` (${projectName})` : "";
}

/**
 * Condense the window into a short markdown block, or a single "nothing notable"
 * line. Two thesis-aligned sections: chronic under-estimation and chronic
 * deferral. Each is capped at TOP_N lines so the prompt stays compact.
 */
export function summarizeReviewHistory(rows: ExportRow[], days: number): string {
  const rollups = rollUpByTask(rows);

  const underestimated = rollups
    .filter(
      (t) =>
        t.completedDays >= MIN_COMPLETED_DAYS &&
        t.plannedSum > 0 &&
        t.actualSum / t.plannedSum >= UNDERESTIMATE_RATIO,
    )
    .map((t) => ({ t, ratio: t.actualSum / t.plannedSum }))
    .sort((a, b) => b.ratio - a.ratio)
    .slice(0, TOP_N);

  const deferred = rollups
    .filter(
      (t) => t.deferredDays >= MIN_DEFERRED_SIGNAL || t.maxCarriedOver >= MIN_DEFERRED_SIGNAL,
    )
    .map((t) => ({ t, weight: Math.max(t.deferredDays, t.maxCarriedOver) }))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, TOP_N);

  if (underestimated.length === 0 && deferred.length === 0) {
    return `(no notable estimation or deferral patterns in the last ${days} days)`;
  }

  const lines: string[] = [];

  if (underestimated.length > 0) {
    lines.push("Chronic under-estimation (planned vs. actual over the window):");
    for (const { t, ratio } of underestimated) {
      lines.push(
        `- "${t.taskName}"${projectSuffix(t.projectName)}: ${t.completedDays} days, ` +
          `planned ${formatMinutes(t.plannedSum)} → actual ${formatMinutes(t.actualSum)} ` +
          `(${ratio.toFixed(1)}× over)`,
      );
    }
  }

  if (deferred.length > 0) {
    if (lines.length > 0) lines.push("");
    lines.push("Repeatedly deferred / carried over:");
    for (const { t } of deferred) {
      const parts: string[] = [];
      if (t.deferredDays > 0) parts.push(`deferred ${t.deferredDays}d`);
      if (t.maxCarriedOver > 0) parts.push(`carried over ${t.maxCarriedOver}×`);
      lines.push(`- "${t.taskName}"${projectSuffix(t.projectName)}: ${parts.join(", ")}`);
    }
  }

  return lines.join("\n");
}
