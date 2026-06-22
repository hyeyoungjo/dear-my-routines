import { type Span, durationMinutes } from "./calendar";
import { shiftSpanOntoGridDay } from "./carry";
import { dayKey, gridDayOf } from "./day";

/**
 * Pure logic for `action_blocks` (ADR-015): a task's *actual executions*. Action
 * is its own list, separate from `plan_blocks` — a row existing means "done",
 * there is no status. A task done across two days is two rows. `nodes` carries
 * identity + the stats unit; a task's actions are 1:N. No React, no DB, no
 * network (CLAUDE.md CRITICAL).
 *
 * The estimate-vs-actual comparison is NOT here and never on a calendar block —
 * stats join plan_blocks + action_blocks by node (`actualMinutesOf` is the
 * actual side of that join). The grid boundary / shift delegate to day.ts /
 * carry.ts. Actions arrive over the wire with ISO-string timestamps.
 */

/** An action_block as it arrives over the wire (timestamps as ISO strings). */
export type ActionBlock = {
  id: string;
  nodeId: string;
  gridDay: string;
  startAt: string;
  endAt: string;
};

/**
 * Which grid day an action belongs to: anchored by its start's grid day so the
 * span is drawn on the day it counts toward. An action always has a start, so
 * there is no date-less fallback.
 */
export function actionBelongsToDay(action: ActionBlock, date: Date): boolean {
  return gridDayOf(new Date(action.startAt)) === dayKey(date);
}

/** The subset of actions that belong to `date` (see `actionBelongsToDay`). */
export function actionsForDay(actions: ActionBlock[], date: Date): ActionBlock[] {
  return actions.filter((action) => actionBelongsToDay(action, date));
}

/** The action's span as concrete Dates. Both edges always exist (notNull). */
export function actionSpan(action: ActionBlock): Span {
  return { start: new Date(action.startAt), end: new Date(action.endAt) };
}

/**
 * Manual reschedule of an action to `toDate`, keeping the clock time and exact
 * duration. Unlike the old task_blocks actual (which stayed anchored to the
 * plan's day), an action now owns its own `gridDay` and moves it with the span —
 * it records when the task was *actually* done, independent of any plan.
 */
export function shiftAction(action: ActionBlock, toDate: Date): Partial<ActionBlock> {
  const { start, end } = shiftSpanOntoGridDay(action.startAt, action.endAt, toDate);
  return {
    startAt: start.toISOString(),
    endAt: end!.toISOString(),
    gridDay: dayKey(toDate),
  };
}

// --- Per-task derived values (ADR-015: parities, never stored columns) -----

/** The grid day of the (latest) action — the Plan *executed* date, else null. */
export function actualDateOf(nodeActions: ActionBlock[]): string | null {
  if (nodeActions.length === 0) return null;
  return nodeActions.reduce(
    (max, a) => (a.gridDay > max ? a.gridDay : max),
    nodeActions[0].gridDay,
  );
}

/**
 * Total minutes actually spent on a task — the sum of its action spans. This is
 * the *actual* side of the estimate-vs-actual stat (the estimate side comes from
 * the node / its plans); the comparison is computed in stats, never on a block.
 */
export function actualMinutesOf(nodeActions: ActionBlock[]): number {
  return nodeActions.reduce(
    (sum, a) => sum + durationMinutes(new Date(a.startAt), new Date(a.endAt)),
    0,
  );
}
