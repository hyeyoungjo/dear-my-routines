import type { Span } from "./calendar";
import {
  DEFAULT_GRID_END_HOUR,
  DEFAULT_GRID_START_HOUR,
  SNAP_MINUTES,
  snapMinutes,
} from "./calendar";
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

/** ms timestamps of the grid window [startHour, endHour) on `day`. */
function windowBounds(
  day: Date,
  startHour: number,
  endHour: number,
): { start: number; end: number } {
  const midnight = new Date(day);
  midnight.setHours(0, 0, 0, 0);
  const ms = midnight.getTime();
  return { start: ms + startHour * 3_600_000, end: ms + endHour * 3_600_000 };
}

/**
 * Whether a plan's startAt falls within the grid window for `day`. The window
 * is [gridStartHour, gridEndHour) from midnight of `day`; endHour > 24 reaches
 * into the next calendar day, enabling cross-midnight grids.
 */
export function planBelongsToDay(
  plan: PlanBlock,
  day: Date,
  gridStartHour = DEFAULT_GRID_START_HOUR,
  gridEndHour = DEFAULT_GRID_END_HOUR,
): boolean {
  const { start, end } = windowBounds(day, gridStartHour, gridEndHour);
  const t = new Date(plan.startAt).getTime();
  return t >= start && t < end;
}

/** Plans whose startAt falls within the grid window for `day`. */
export function plansForDay(
  plans: PlanBlock[],
  day: Date,
  gridStartHour = DEFAULT_GRID_START_HOUR,
  gridEndHour = DEFAULT_GRID_END_HOUR,
): PlanBlock[] {
  return plans.filter((plan) => planBelongsToDay(plan, day, gridStartHour, gridEndHour));
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

/** Snap a Date to the nearest SNAP_MINUTES boundary of its own calendar day. */
function snapToNearest(date: Date): Date {
  const mins = date.getHours() * 60 + date.getMinutes();
  const result = new Date(date);
  result.setHours(0, snapMinutes(mins, SNAP_MINUTES), 0, 0);
  return result;
}

/**
 * The span for a "continue later today" plan block: placed one gap after the
 * source block's END (block-relative, NOT now-relative — this is called from
 * both plan and action blocks, and a plan block is unrelated to wall-clock now).
 * Default 60-minute gap + 60-minute block. Clamped so the block's end never
 * exceeds the grid window end for `day`.
 */
export function continueLaterSpan(
  sourceEnd: Date,
  day: Date,
  gridEndHour = DEFAULT_GRID_END_HOUR,
  gapMinutes = 60,
  durationMinutes = 60,
): Span {
  const durationMs = durationMinutes * 60_000;
  // 1. start = snap(sourceEnd + gap); 2. end = start + duration.
  let start = snapToNearest(new Date(sourceEnd.getTime() + gapMinutes * 60_000));
  let end = new Date(start.getTime() + durationMs);

  // 3. Grid-end clamp: never let the block spill past the window end. Slide it
  // back (keeping length) so end == windowEnd.
  const midnight = new Date(day);
  midnight.setHours(0, 0, 0, 0);
  const windowEnd = midnight.getTime() + gridEndHour * 3_600_000;
  if (end.getTime() > windowEnd) {
    end = new Date(windowEnd);
    start = new Date(windowEnd - durationMs);
  }

  // 4. Past-guard: if clamping pushed start before the source's end, anchor at
  // sourceEnd instead — a "continue later" piece must not precede its origin
  // (end may then nudge past the window; a rare edge, preferred over going back).
  if (start.getTime() < sourceEnd.getTime()) {
    start = new Date(sourceEnd);
    end = new Date(start.getTime() + durationMs);
  }

  return { start, end };
}

/**
 * The plans the day-boundary sweep should pull forward to `today`: grid day
 * strictly before today's AND still `planned` (`missed` excluded) AND whose task
 * has NOT been executed. Three exclusions:
 *  - non-`planned` is the idempotency core — a plan already carried (missed) or a
 *    fresh plan already on today is never dragged forward again.
 *  - `doneTaskIds` are tasks that already have an action_block. Completion lives
 *    on action, not plan (plan has no "done" status), so a finished task's plan
 *    stays `planned` forever — without this guard the sweep re-creates the task
 *    every day (the duplicate-task bug). "Has an action" is exactly the bar
 *    model's done signal (see span.ts `barEndDay`).
 * YYYY-MM-DD sorts lexicographically = chronologically.
 */
export function findOverduePlans(
  plans: PlanBlock[],
  today: Date,
  doneTaskIds: ReadonlySet<string> = new Set(),
): PlanBlock[] {
  const todayGridDay = gridDayOf(today);
  return plans.filter(
    (plan) =>
      plan.status === "planned" &&
      plan.date < todayGridDay &&
      !doneTaskIds.has(plan.taskId),
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

/** How many times this task was carried before reaching `beforeDate` (exclusive). */
export function carryCountUpTo(taskPlans: PlanBlock[], beforeDate: string): number {
  return taskPlans.filter((p) => p.status === "missed" && p.date < beforeDate).length;
}
