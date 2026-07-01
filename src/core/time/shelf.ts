import { DEFAULT_GRID_START_HOUR } from "./calendar";
import { shiftSpanOntoGridDay } from "./carry";
import { dayKey, startOfDay } from "./day";
import type { PlanBlock } from "./plan";

/**
 * Pure logic for Shelf (ADR-026): a task the user intentionally *parks* for
 * later. Unlike carry-over (passive, automatic), shelving is an explicit "not
 * now" — the one piece of task state that can't be derived from plans/actions,
 * so `tasks.shelvedAt` stores it. These helpers keep the sweep, the calendar
 * filter and un-shelve free of DB/React (CLAUDE.md CRITICAL: core is pure).
 */

/** Minimal shape needed to read a task's shelf state (avoid binding core to the full DB row). */
type ShelfState = { shelvedAt: Date | string | null };

/** A task is shelved when it has a `shelvedAt` timestamp (ADR-026). null = active. */
export function isShelved(task: ShelfState): boolean {
  return task.shelvedAt != null;
}

/**
 * The set of taskIds currently shelved — fed to the carry-over sweep's skip set
 * (union with doneTaskIds) and to the calendar's render filter.
 */
export function shelvedTaskIds(
  tasks: ReadonlyArray<{ taskId: string } & ShelfState>,
): Set<string> {
  return new Set(tasks.filter(isShelved).map((t) => t.taskId));
}

/** The most recent plan of a task — latest `date`, tie-broken by latest startAt. */
function latestPlan(taskPlans: PlanBlock[]): PlanBlock | null {
  if (taskPlans.length === 0) return null;
  return taskPlans.reduce((latest, p) => {
    if (p.date > latest.date) return p;
    if (p.date < latest.date) return latest;
    return p.startAt > latest.startAt ? p : latest;
  }, taskPlans[0]);
}

/**
 * Build the fresh `planned` plan an un-shelve drops onto `today` (ADR-026).
 * Returns a new plan's data (no planBlockId — the optimistic layer mints it),
 * the same shape `carryOverPlan` returns for `nextPlan`.
 *  - Prior plans exist → preserve the clock + duration of the most recent one,
 *    shifted onto `today` (re-plan at the hour the user used to do it).
 *  - No prior plans → a default 1-hour slot at DEFAULT_GRID_START_HOUR on `today`.
 * Old `missed` plans are never resurrected — un-shelve is a clean restart.
 */
export function freshPlanToday(
  taskId: string,
  taskPlans: PlanBlock[],
  today: Date,
): Omit<PlanBlock, "planBlockId"> {
  const recent = latestPlan(taskPlans);
  if (recent) {
    const { start, end } = shiftSpanOntoGridDay(
      recent.startAt,
      recent.endAt,
      today,
    );
    return {
      taskId,
      date: dayKey(today),
      startAt: start.toISOString(),
      endAt: end!.toISOString(),
      status: "planned",
    };
  }

  const start = startOfDay(today);
  start.setHours(DEFAULT_GRID_START_HOUR, 0, 0, 0);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  return {
    taskId,
    date: dayKey(today),
    startAt: start.toISOString(),
    endAt: end.toISOString(),
    status: "planned",
  };
}
