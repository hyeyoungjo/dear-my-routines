import { type Span, DEFAULT_GRID_END_HOUR, DEFAULT_GRID_START_HOUR, durationMinutes } from "./calendar";
import { shiftSpanOntoGridDay } from "./carry";
import { dayKey, gridDayOf } from "./day";
import type { PlanBlock } from "./plan";

/**
 * Pure logic for `action_blocks` (ADR-015/016): a task's *actual executions*.
 * Action is its own list, separate from `plan_blocks`. A task done across two
 * days is two rows. Nothing about an action is a stored status — its *kind*
 * (kept/revised/added vs the plan) and whether it is *doing* (now within its
 * span) are derived here. `endAt` is null only for a still-running span (future
 * timer). No React, no DB, no network (CLAUDE.md CRITICAL).
 *
 * The estimate-vs-actual comparison is NOT here and never on a calendar block —
 * stats join plan_blocks + action_blocks by task (`actualMinutesOf` is the
 * actual side). The grid boundary / shift delegate to day.ts / carry.ts.
 */

/** An action_block as it arrives over the wire (timestamps as ISO strings). */
export type ActionBlock = {
  actionBlockId: string;
  taskId: string;
  /**
   * The plan piece this action was confirmed from (ghost click), if any
   * (ADR-030). Optional/null for directly-created actions — their relation to
   * a plan stays derived (time overlap), never stored.
   */
  planBlockId?: string | null;
  date: string;
  startAt: string;
  /** Null while still running — the span has not finished yet. */
  endAt: string | null;
  /** `done` = fully completed; `partial` = user explicitly continues tomorrow. */
  status: "done" | "partial";
};

/**
 * How an action relates to its plan (ADR-016), derived by comparing it to the
 * same task's plans on the same day:
 *  - `added`   — no plan that day for this task (unplanned work)
 *  - `kept`    — a plan exists and the action span equals it exactly
 *  - `revised` — a plan exists but the action span differs (time/duration moved)
 * A still-running action (no end) can't equal a plan, so it reads `revised`.
 */
export type ActionKind = "kept" | "revised" | "added";

export function actionKindOf(action: ActionBlock, plans: PlanBlock[]): ActionKind {
  const sameDay = plans.filter(
    (p) => p.taskId === action.taskId && p.date === action.date,
  );
  if (sameDay.length === 0) return "added";
  const start = new Date(action.startAt).getTime();
  const end = action.endAt ? new Date(action.endAt).getTime() : null;
  const kept = sameDay.some(
    (p) =>
      new Date(p.startAt).getTime() === start &&
      end !== null &&
      new Date(p.endAt).getTime() === end,
  );
  return kept ? "kept" : "revised";
}

/**
 * Whether an action is happening *now* — `now` falls within its span (a running
 * action, no end, counts as ongoing from its start). This is what drives the
 * "doing" highlight and the task-level `doing` status; it is purely temporal,
 * never a stored flag.
 */
export function isOngoing(action: ActionBlock, now: Date): boolean {
  const start = new Date(action.startAt).getTime();
  const t = now.getTime();
  if (t < start) return false;
  return action.endAt == null || t <= new Date(action.endAt).getTime();
}

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
 * Whether an action's startAt falls within the grid window for `day`. endHour > 24
 * reaches into the next calendar day for cross-midnight grids.
 */
export function actionBelongsToDay(
  action: ActionBlock,
  day: Date,
  gridStartHour = DEFAULT_GRID_START_HOUR,
  gridEndHour = DEFAULT_GRID_END_HOUR,
): boolean {
  const { start, end } = windowBounds(day, gridStartHour, gridEndHour);
  const t = new Date(action.startAt).getTime();
  return t >= start && t < end;
}

/** Actions whose startAt falls within the grid window for `day`. */
export function actionsForDay(
  actions: ActionBlock[],
  day: Date,
  gridStartHour = DEFAULT_GRID_START_HOUR,
  gridEndHour = DEFAULT_GRID_END_HOUR,
): ActionBlock[] {
  return actions.filter((action) => actionBelongsToDay(action, day, gridStartHour, gridEndHour));
}

/**
 * The action's span as concrete Dates, or null while still running — a span with
 * no end can't form a Span (calendar.ts needs both edges).
 */
export function actionSpan(action: ActionBlock): Span | null {
  if (!action.endAt) return null;
  return { start: new Date(action.startAt), end: new Date(action.endAt) };
}

/**
 * Manual reschedule of an action to `toDate`, keeping the clock time and exact
 * duration. Unlike the old task_blocks actual (which stayed anchored to the
 * plan's day), an action owns its own `date` and moves it with the span — it
 * records when the task was *actually* done, independent of any plan. A running
 * action (no end) just moves its start.
 */
export function shiftAction(action: ActionBlock, toDate: Date): Partial<ActionBlock> {
  const { start, end } = shiftSpanOntoGridDay(action.startAt, action.endAt, toDate);
  const patch: Partial<ActionBlock> = {
    startAt: start.toISOString(),
    date: dayKey(toDate),
  };
  if (end) patch.endAt = end.toISOString();
  return patch;
}

// --- Per-task derived values (ADR-015: parities, never stored columns) -----

/** The grid day of the (latest) action — the Plan *executed* date, else null. */
export function actualDateOf(taskActions: ActionBlock[]): string | null {
  if (taskActions.length === 0) return null;
  return taskActions.reduce(
    (max, a) => (a.date > max ? a.date : max),
    taskActions[0].date,
  );
}

/**
 * Total minutes actually spent on a task — the sum of its *finished* action
 * spans (a still-running span has no end, so it contributes nothing yet). This
 * is the actual side of the estimate-vs-actual stat (the estimate side comes
 * from the task's plans); the comparison is computed in stats, never on a block.
 */
export function actualMinutesOf(taskActions: ActionBlock[]): number {
  return taskActions.reduce(
    (sum, a) =>
      a.endAt
        ? sum + durationMinutes(new Date(a.startAt), new Date(a.endAt))
        : sum,
    0,
  );
}
