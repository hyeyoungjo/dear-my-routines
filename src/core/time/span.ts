import type { ActionBlock } from "./action";
import { shiftSpanOntoGridDay } from "./carry";
import { addDays, dayFromKey, dayKey } from "./day";
import type { PlanBlock } from "./plan";

/**
 * The "bar" model (the user's mental model): a task is one multi-day event, like
 * a Google-Calendar event spanning several days. Its plan_blocks form a
 * continuous bar:
 *   - **start** = the earliest plan day (originally planned)
 *   - **end**   = the action day if done, else the latest plan day (still open)
 *   - **middle days** = all `missed` (the days it was carried, ✕)
 *
 * Editing one end (Originally / Done) shifts that end and *refills or trims* the
 * missed middle so the stored rows always match the bar. carryCount (= the count
 * of `missed`) therefore stays exactly the bar length minus its live/done end —
 * it can never drift out of sync. Pure logic — no React, no DB, no network
 * (CLAUDE.md CRITICAL): every function returns the *row edits* to apply, and the
 * hook layer turns them into optimistic mutations.
 *
 * Only the last day of the bar (the live plan, or the done day) is `planned`;
 * every earlier day is `missed`. The clock (HH:MM + duration) is taken from an
 * existing plan and kept on every day via `shiftSpanOntoGridDay`.
 */

/** The row edits to apply to a task's plan_blocks to match a target bar. */
export type PlanEdit = {
  updates: { planBlockId: string; patch: Partial<PlanBlock> }[];
  inserts: Omit<PlanBlock, "planBlockId">[];
  deletes: string[];
};

/** The single row edit to apply to a task's action_block for a Done-day move. */
export type ActionEdit =
  | { kind: "update"; actionBlockId: string; patch: Partial<ActionBlock> }
  | { kind: "insert"; row: Omit<ActionBlock, "actionBlockId"> };

/** The bar's start day (earliest plan), or null if the task has no plans. */
export function barStartDay(plans: PlanBlock[]): string | null {
  if (plans.length === 0) return null;
  return plans.reduce((min, p) => (p.date < min ? p.date : min), plans[0].date);
}

/** The bar's end day: the action day if done, else the latest plan day. */
export function barEndDay(
  plans: PlanBlock[],
  action: ActionBlock | null,
): string | null {
  if (action) return action.date;
  if (plans.length === 0) return null;
  return plans.reduce((max, p) => (p.date > max ? p.date : max), plans[0].date);
}

/** Inclusive list of `YYYY-MM-DD` keys from startDay to endDay (empty if start > end). */
function dayRange(startDay: string, endDay: string): string[] {
  const days: string[] = [];
  let cursor = dayFromKey(startDay);
  while (dayKey(cursor) <= endDay) {
    days.push(dayKey(cursor));
    cursor = addDays(cursor, 1);
  }
  return days;
}

/**
 * Reconcile a task's plan rows so they form a continuous bar over
 * [startDay, endDay]: one plan per day, the last day `planned` and every earlier
 * day `missed`, all sharing the existing clock. Days that fall outside the range
 * are deleted. Returns the minimal edits (only rows that actually change).
 */
export function reconcileBar(
  plans: PlanBlock[],
  taskId: string,
  startDay: string,
  endDay: string,
): PlanEdit {
  const edit: PlanEdit = { updates: [], inserts: [], deletes: [] };
  if (plans.length === 0) return edit; // no clock source — nothing to build from
  const ref = plans[0]; // clock (HH:MM + duration) source; all days share it
  const byDate = new Map(plans.map((p) => [p.date, p]));
  const range = dayRange(startDay, endDay);
  const inRange = new Set(range);

  for (const d of range) {
    const status: PlanBlock["status"] = d === endDay ? "planned" : "missed";
    const { start, end } = shiftSpanOntoGridDay(
      ref.startAt,
      ref.endAt,
      dayFromKey(d),
    );
    const startAt = start.toISOString();
    const endAt = end!.toISOString(); // a plan always has an end
    const existing = byDate.get(d);
    if (existing) {
      const patch: Partial<PlanBlock> = {};
      if (existing.startAt !== startAt) patch.startAt = startAt;
      if (existing.endAt !== endAt) patch.endAt = endAt;
      if (existing.status !== status) patch.status = status;
      if (Object.keys(patch).length)
        edit.updates.push({ planBlockId: existing.planBlockId, patch });
    } else {
      edit.inserts.push({ taskId, date: d, startAt, endAt, status });
    }
  }
  // Plans now outside the bar are dropped (the bar shrank past them).
  for (const p of plans) {
    if (!inRange.has(p.date)) edit.deletes.push(p.planBlockId);
  }
  return edit;
}

/**
 * Move the bar's LEFT end (originally planned) to `newStartDay`, keeping the
 * existing end. Growing left adds `missed` days; shrinking left drops them. The
 * action (the right end) is untouched. Clamped so the start can't pass the end.
 */
export function setOriginalDay(
  plans: PlanBlock[],
  taskId: string,
  newStartDay: string,
  action: ActionBlock | null,
): PlanEdit {
  const end = barEndDay(plans, action);
  if (end === null) return { updates: [], inserts: [], deletes: [] };
  const start = newStartDay <= end ? newStartDay : end;
  return reconcileBar(plans, taskId, start, end);
}

/**
 * Move the bar's RIGHT end (the day it was actually done) to `newDoneDay`: the
 * plan bar is refilled/trimmed to end there, and the action is moved onto that
 * day (or created from the plan's clock if the task wasn't done yet). Clamped so
 * the done day can't precede the bar's start.
 */
export function setDoneDay(
  plans: PlanBlock[],
  action: ActionBlock | null,
  taskId: string,
  newDoneDay: string,
): { plan: PlanEdit; action: ActionEdit | null } {
  const start = barStartDay(plans);
  const startDay =
    start !== null && start <= newDoneDay ? start : newDoneDay;
  const plan = reconcileBar(plans, taskId, startDay, newDoneDay);

  let actionEdit: ActionEdit | null = null;
  if (action) {
    // Move the existing action, keeping ITS own clock (a manual reschedule).
    const { start: aStart, end: aEnd } = shiftSpanOntoGridDay(
      action.startAt,
      action.endAt,
      dayFromKey(newDoneDay),
    );
    actionEdit = {
      kind: "update",
      actionBlockId: action.actionBlockId,
      patch: {
        date: newDoneDay,
        startAt: aStart.toISOString(),
        endAt: aEnd ? aEnd.toISOString() : null,
      },
    };
  } else if (plans.length > 0) {
    // No action yet → create one from the plan's clock on the done day.
    const ref = plans[0];
    const { start: aStart, end: aEnd } = shiftSpanOntoGridDay(
      ref.startAt,
      ref.endAt,
      dayFromKey(newDoneDay),
    );
    actionEdit = {
      kind: "insert",
      row: {
        taskId,
        date: newDoneDay,
        startAt: aStart.toISOString(),
        endAt: aEnd ? aEnd.toISOString() : null,
      },
    };
  }
  return { plan, action: actionEdit };
}
