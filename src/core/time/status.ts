import type { ActionBlock } from "./action";
import { gridDayOf } from "./day";
import { type PlanBlock, revisedDateOf } from "./plan";

/**
 * A task's *current status* (ADR-015): one derived, task-level rollup for the
 * Task list / stats / review. Never stored — computed from a node's plans +
 * actions, the same "derive, don't store" rule as carryCount / originalDate.
 *
 * This is distinct from a plan_block's per-day `status` (planned|missed), which
 * only says how to draw one day's box. `currentStatusOf` says where the *whole
 * task* stands by rolling those occurrences up against its actions.
 *
 * "doing" (a task in progress) will join once a running-timer / open action
 * exists — today's actions always have an end, so it is not derivable yet.
 */
export type TaskStatus = "planned" | "missed" | "done";

/**
 * Roll a node's plans + actions up to one status, as of `today`:
 *  - a live plan on today/future  → "planned" (still on the books, on track)
 *  - else acted on at all         → "done"
 *  - else plans exist(ed) but none live ahead → "missed" (fell behind)
 *  - else (no plans at all)        → "planned" (an unscheduled todo)
 * Action wins over a stale past plan, so doing it clears the "behind" feeling;
 * a live future plan wins over past actions, so a subproject still reads as
 * "planned" while more remains.
 */
export function currentStatusOf(
  plans: PlanBlock[],
  actions: ActionBlock[],
  today: Date,
): TaskStatus {
  const live = revisedDateOf(plans); // latest still-`planned` grid day, or null
  const liveAhead = live !== null && live >= gridDayOf(today);

  if (liveAhead) return "planned";
  if (actions.length > 0) return "done";
  if (plans.length > 0) return "missed";
  return "planned";
}
