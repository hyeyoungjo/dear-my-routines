import type { Span } from "./calendar";
import { shiftSpanOntoGridDay } from "./carry";
import { dayKey, gridDayOf } from "./day";

/**
 * Pure logic for `plan_blocks` (ADR-015/016): a task's per-day *intentions*.
 * Plan is its own list, fully separate from `action_blocks` — a single row never
 * holds a planned + actual pair, so the forced "2h→9h" comparison is gone by
 * construction. `tasks` carries identity + the stats unit; a task's plans are
 * 1:N. Carry-over and the *derived* per-task dates (original/revised) and
 * carryCount live here — no React, no DB, no network (CLAUDE.md CRITICAL).
 *
 * The 07:00 → 02:00 grid boundary (ADR-013) and the clock/duration-preserving
 * shift are NOT redefined here: they delegate to `day.ts` / `carry.ts`. Plans
 * arrive over the wire with ISO-string timestamps, normalized via `new Date`.
 */

/** A plan_block as it arrives over the wire (timestamps as ISO strings). */
export type PlanBlock = {
  planBlockId: string;
  taskId: string;
  date: string;
  startAt: string;
  endAt: string;
  status: "planned" | "missed";
};

/**
 * Which grid day a plan belongs to: anchored by its start's grid day so "where
 * it is drawn" and "which day it counts toward" always agree. A plan is always
 * placed as a box (ADR-015), so its start exists — no date-less fallback.
 */
export function planBelongsToDay(plan: PlanBlock, day: Date): boolean {
  return gridDayOf(new Date(plan.startAt)) === dayKey(day);
}

/** The subset of plans that belong to `day` (see `planBelongsToDay`). */
export function plansForDay(plans: PlanBlock[], day: Date): PlanBlock[] {
  return plans.filter((plan) => planBelongsToDay(plan, day));
}

/** The plan's span as concrete Dates. Both edges always exist (notNull). */
export function planSpan(plan: PlanBlock): Span {
  return { start: new Date(plan.startAt), end: new Date(plan.endAt) };
}

/**
 * Manual reschedule of a plan to `toDate`, keeping the clock time and exact
 * duration — only the calendar date (and the `date` that tracks it) move.
 * Status is untouched: dragging a date is not a carry-over (ADR-009).
 */
export function shiftPlan(plan: PlanBlock, toDate: Date): Partial<PlanBlock> {
  const { start, end } = shiftSpanOntoGridDay(plan.startAt, plan.endAt, toDate);
  return {
    startAt: start.toISOString(),
    endAt: end!.toISOString(),
    date: dayKey(toDate),
  };
}

/**
 * Carry an undone plan forward (ADR-015): THIS plan stays `missed` (kept as
 * review evidence) and a fresh `planned` plan is born on `toDate` for the same
 * task, span shifted (clock + duration kept). No actual is involved — action is
 * a separate list now. Returns the patch for this plan AND the new plan's data;
 * the caller marks one row missed and inserts the other.
 */
export function carryOverPlan(
  plan: PlanBlock,
  toDate: Date,
): { missedPatch: Partial<PlanBlock>; nextPlan: Omit<PlanBlock, "planBlockId"> } {
  const { start, end } = shiftSpanOntoGridDay(plan.startAt, plan.endAt, toDate);
  return {
    missedPatch: { status: "missed" },
    nextPlan: {
      taskId: plan.taskId,
      date: dayKey(toDate),
      startAt: start.toISOString(),
      endAt: end!.toISOString(),
      status: "planned",
    },
  };
}

/**
 * The plans the day-boundary sweep should pull forward to `today`: grid day
 * strictly before today's AND still `planned` (`missed` excluded). Excluding
 * non-planned is the idempotency core — a plan already carried (missed) or a
 * fresh plan already on today is never dragged forward again. YYYY-MM-DD sorts
 * lexicographically = chronologically.
 */
export function findOverduePlans(plans: PlanBlock[], today: Date): PlanBlock[] {
  const todayGridDay = gridDayOf(today);
  return plans.filter(
    (plan) => plan.status === "planned" && plan.date < todayGridDay,
  );
}

// --- Per-task derived dates (ADR-015: parities, never stored columns) ------

/** The earliest grid day among a task's plans — the Plan *original* date. */
export function originalDateOf(taskPlans: PlanBlock[]): string | null {
  if (taskPlans.length === 0) return null;
  return taskPlans.reduce(
    (min, p) => (p.date < min ? p.date : min),
    taskPlans[0].date,
  );
}

/** The latest still-`planned` grid day — the Plan *revised* (live) date. */
export function revisedDateOf(taskPlans: PlanBlock[]): string | null {
  const planned = taskPlans.filter((p) => p.status === "planned");
  if (planned.length === 0) return null;
  return planned.reduce(
    (max, p) => (p.date > max ? p.date : max),
    planned[0].date,
  );
}

/** How many times this task was carried — the count of `missed` plans. */
export function carryCountOf(taskPlans: PlanBlock[]): number {
  return taskPlans.filter((p) => p.status === "missed").length;
}
