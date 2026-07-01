"use client";

import { freshPlanToday } from "@/core/time/shelf";
import { startOfDay } from "@/core/time/day";
import {
  useAddPlanBlock,
  usePlanBlocks,
  useRemovePlanBlock,
} from "@/hooks/planBlocks";
import { useUpdateTask } from "@/hooks/tasks";

/**
 * Shelf actions (ADR-026), shared by the task detail modal and the shelf tray so
 * the flow lives in one place (no duplicate implementation).
 *
 *  - `shelve` deletes the task's *plan* blocks (its calendar-plan footprint) and
 *    stamps `shelvedAt = now`. Its *action* blocks — real recorded work, the core
 *    "estimate vs actual" data — are kept (hidden by the shelvedAt filter). A task
 *    is thus either on the calendar OR on the shelf, never a hidden ghost of both,
 *    so bringing it back can't duplicate a block. carry-count resets, which suits
 *    the shelf's purpose: a deliberate reset of the delay pile.
 *  - `unshelve` clears `shelvedAt` and adds one fresh `planned` block on today
 *    (no plans remain, so exactly one — never a duplicate).
 *
 * All writes are optimistic and roll back on failure (ADR-007).
 */
export function useShelf() {
  const updateTask = useUpdateTask();
  const addPlanBlock = useAddPlanBlock();
  const removePlanBlock = useRemovePlanBlock();
  const { data: planData } = usePlanBlocks();

  const shelve = (taskId: string) => {
    for (const p of (planData ?? []).filter((p) => p.taskId === taskId)) {
      removePlanBlock.mutate(p.planBlockId);
    }
    updateTask.mutate({ taskId, patch: { shelvedAt: new Date() } });
  };

  const unshelve = (taskId: string) => {
    updateTask.mutate({ taskId, patch: { shelvedAt: null } });
    addPlanBlock.mutate(freshPlanToday(taskId, [], startOfDay(new Date())));
  };

  return { shelve, unshelve };
}
