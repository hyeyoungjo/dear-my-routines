import { type ActionBlock, isOngoing } from "./action";
import { gridDayOf } from "./day";
import { type PlanBlock, revisedDateOf } from "./plan";

/**
 * A task's *current status* (ADR-016): one derived, task-level rollup for the
 * Task list / stats / review. Never stored — computed from a task's plans +
 * actions, the same "derive, don't store" rule as carryCount / originalDate.
 *
 * Distinct from a plan_block's per-day `status` (planned|missed) and an action's
 * `kind` (kept|revised|added). `doing` is purely temporal (an action spanning
 * now); the others roll plans up against actions.
 */
export type TaskStatus = "todo" | "doing" | "overdue" | "done";

/**
 * Roll a task's plans + actions up to one status, as of `now`:
 *  - an action spanning now         → "doing"
 *  - else a live plan today/future  → "todo" (on track, still on the books)
 *  - else acted on at all           → "done"
 *  - else plans exist but none live  → "overdue" (fell behind)
 *  - else (no plans at all)          → "todo" (an unscheduled todo)
 * A live future plan wins over past actions, so a subproject still reads "todo"
 * while more remains; doing it now wins over everything.
 */
export function currentStatusOf(
  plans: PlanBlock[],
  actions: ActionBlock[],
  now: Date,
): TaskStatus {
  if (actions.some((a) => isOngoing(a, now))) return "doing";

  const live = revisedDateOf(plans); // latest still-`planned` grid day, or null
  const liveAhead = live !== null && live >= gridDayOf(now);

  if (liveAhead) return "todo";
  if (actions.length > 0) return "done";
  if (plans.length > 0) return "overdue";
  return "todo";
}

/**
 * Roll a project's task statuses up to one status (ADR-016), surfacing the most
 * attention-worthy: anything in progress, else anything behind, else complete
 * only when every task is done, else still on the books. An empty project reads
 * "todo".
 */
export function projectStatusOf(taskStatuses: TaskStatus[]): TaskStatus {
  if (taskStatuses.length === 0) return "todo";
  if (taskStatuses.includes("doing")) return "doing";
  if (taskStatuses.includes("overdue")) return "overdue";
  if (taskStatuses.every((s) => s === "done")) return "done";
  return "todo";
}
