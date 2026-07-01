"use client";

import type { PlanBlock } from "@/core/time/plan";
import { freshPlanToday } from "@/core/time/shelf";
import { startOfDay } from "@/core/time/day";
import { useAddPlanBlock } from "@/hooks/planBlocks";
import { useUpdateTask } from "@/hooks/tasks";

/**
 * Shelf actions (ADR-026), shared by the task detail modal and the shelf tray so
 * the "bring back" flow lives in one place (no duplicate implementation).
 *
 *  - `shelve` stamps `shelvedAt = now`: the carry-over sweep skips the task and
 *    the calendar hides its blocks — an optimistic `useUpdateTask` patch.
 *  - `unshelve` clears `shelvedAt` AND drops a fresh `planned` block onto today
 *    (`freshPlanToday`, keeping the task's usual clock) so it re-enters the plan
 *    at once. Old `missed` plans are never resurrected — a clean restart. Both
 *    writes are optimistic and roll back on failure (ADR-007).
 */
export function useShelf() {
  const updateTask = useUpdateTask();
  const addPlanBlock = useAddPlanBlock();

  const shelve = (taskId: string) => {
    updateTask.mutate({ taskId, patch: { shelvedAt: new Date() } });
  };

  const unshelve = (taskId: string, taskPlans: PlanBlock[]) => {
    updateTask.mutate({ taskId, patch: { shelvedAt: null } });
    addPlanBlock.mutate(freshPlanToday(taskId, taskPlans, startOfDay(new Date())));
  };

  return { shelve, unshelve };
}
