import type { ActionBlock } from "./action";
import { gridDayOf } from "./day";
import { type PlanBlock, revisedDateOf } from "./plan";

/**
 * A task's *current status* (ADR-015/016): one derived, task-level rollup for
 * the Task list / stats / review. Never stored — computed from a task's plans +
 * actions, the same "derive, don't store" rule as carryCount / originalDate.
 *
 * Distinct from a plan_block's per-day `status` (planned|missed), which only
 * says how to draw one day's box. `currentStatusOf` says where the *whole task*
 * stands by rolling those occurrences up against its actions.
 */
export type TaskStatus = "planned" | "missed" | "in-progress" | "done";

/**
 * Roll a task's plans + actions up to one status, as of `today`:
 *  - any action in progress       → "in-progress" (doing it right now)
 *  - else a live plan today/future → "planned" (still on the books, on track)
 *  - else acted on at all          → "done"
 *  - else plans exist(ed) but none live ahead → "missed" (fell behind)
 *  - else (no plans at all)         → "planned" (an unscheduled todo)
 * A live future plan wins over past actions, so a subproject still reads as
 * "planned" while more remains; doing it clears a stale "behind" feeling.
 */
export function currentStatusOf(
  plans: PlanBlock[],
  actions: ActionBlock[],
  today: Date,
): TaskStatus {
  if (actions.some((a) => a.status === "in-progress")) return "in-progress";

  const live = revisedDateOf(plans); // latest still-`planned` grid day, or null
  const liveAhead = live !== null && live >= gridDayOf(today);

  if (liveAhead) return "planned";
  if (actions.length > 0) return "done";
  if (plans.length > 0) return "missed";
  return "planned";
}
