import { type Span, durationMinutes } from "./calendar";
import { shiftSpanOntoGridDay } from "./carry";
import { dayKey, gridDayOf } from "./day";

/**
 * Pure logic for `action_blocks` (ADR-015/016): a task's *actual executions*.
 * Action is its own list, separate from `plan_blocks`. `status` is `in-progress`
 * (running, no end yet — this is "doing") or `done` (finished). A task done
 * across two days is two rows. `tasks` carries identity + the stats unit; a
 * task's actions are 1:N. No React, no DB, no network (CLAUDE.md CRITICAL).
 *
 * The estimate-vs-actual comparison is NOT here and never on a calendar block —
 * stats join plan_blocks + action_blocks by task (`actualMinutesOf` is the
 * actual side of that join). The grid boundary / shift delegate to day.ts /
 * carry.ts. Actions arrive over the wire with ISO-string timestamps.
 */

/** An action_block as it arrives over the wire (timestamps as ISO strings). */
export type ActionBlock = {
  actionBlockId: string;
  taskId: string;
  date: string;
  startAt: string;
  /** Null while `in-progress` — the span has not finished yet. */
  endAt: string | null;
  status: "in-progress" | "done";
};

/**
 * Which grid day an action belongs to: anchored by its start's grid day so the
 * span is drawn on the day it counts toward. An action always has a start, so
 * there is no date-less fallback.
 */
export function actionBelongsToDay(action: ActionBlock, day: Date): boolean {
  return gridDayOf(new Date(action.startAt)) === dayKey(day);
}

/** The subset of actions that belong to `day` (see `actionBelongsToDay`). */
export function actionsForDay(actions: ActionBlock[], day: Date): ActionBlock[] {
  return actions.filter((action) => actionBelongsToDay(action, day));
}

/**
 * The action's span as concrete Dates, or null while `in-progress` — a running
 * span has no end yet, so it can't form a Span (calendar.ts needs both edges).
 */
export function actionSpan(action: ActionBlock): Span | null {
  if (!action.endAt) return null;
  return { start: new Date(action.startAt), end: new Date(action.endAt) };
}

/**
 * Manual reschedule of an action to `toDate`, keeping the clock time and exact
 * duration. Unlike the old task_blocks actual (which stayed anchored to the
 * plan's day), an action owns its own `date` and moves it with the span — it
 * records when the task was *actually* done, independent of any plan. An
 * `in-progress` action (no end) just moves its start.
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
 * spans (an `in-progress` span has no end, so it contributes nothing yet). This
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
