"use client";

import { useEffect, useRef } from "react";
import { carryOverPlan, findOverduePlans } from "@/core/time/plan";
import { startOfDay } from "@/core/time/day";
import { DEFAULT_GRID_END_HOUR } from "@/core/time/calendar";
import { shelvedTaskIds } from "@/core/time/shelf";
import { useActionBlocks } from "@/hooks/actionBlocks";
import { useTasks } from "@/hooks/tasks";
import { useUserSettings } from "@/hooks/userSettings";
import {
  useAddPlanBlock,
  usePlanBlocks,
  useUpdatePlanBlock,
} from "@/hooks/planBlocks";

/**
 * Day-boundary auto carry-over (PRD-4, ADR-015/017): when the app loads, past-due
 * undone *plans* are pulled forward to *today* so they resurface in Plan without
 * the user lifting a finger. A carry is "leave this plan `missed` (kept as review
 * evidence) + birth a fresh `planned` plan on today" (`carryOverPlan`). This is
 * the silent system sweep — no UX weight, no manual button (ADR-017: re-planning
 * is a drag, falling behind is this sweep).
 *
 * It runs **once per mount**, the first time `usePlanBlocks` resolves. Two layers
 * keep `carryCount` from ballooning if the effect re-fires (Strict Mode double
 * mount, the optimistic writes mutating the cache, a settle refetch):
 *  1. `findOverduePlans` only returns plans still `planned` on a grid day before
 *     today, so a plan already carried (now `missed`) or the fresh plan already on
 *     today is never a candidate again (plan.ts — the idempotency core).
 *  2. `sweptRef` flips to true *before* any mutation, so a second effect run on
 *     the same mount returns early — the sweep fires exactly once.
 *
 * Each carry goes through the optimistic `useUpdatePlanBlock` (mark missed) +
 * `useAddPlanBlock` (the new planned plan), so the columns update at once and
 * roll back on failure (ADR-007, no direct fetch).
 */
export function useCarryOverSweep(): void {
  const { data: plans, isSuccess: plansReady } = usePlanBlocks();
  const { data: actions, isSuccess: actionsReady } = useActionBlocks();
  const { data: tasks, isSuccess: tasksReady } = useTasks();
  const { data: userSettings } = useUserSettings();
  const gridEndHour = userSettings?.gridEndTime ?? DEFAULT_GRID_END_HOUR;
  const updatePlanBlock = useUpdatePlanBlock();
  const addPlanBlock = useAddPlanBlock();
  const sweptRef = useRef(false);

  useEffect(() => {
    if (sweptRef.current) return;
    // ALL THREE lists must be loaded: without actions we can't tell which tasks
    // are done, and without tasks we can't tell which are shelved — carrying
    // either forward is a bug (finished task duplicated / shelved task revived).
    if (!plansReady || !plans || !actionsReady || !actions || !tasksReady || !tasks)
      return;
    // Guard BEFORE mutating: a re-run on this mount (Strict Mode, cache change)
    // must find the sweep already done and bail — else carryCount balloons.
    sweptRef.current = true;

    // A task's leftover `planned` plan must NOT be carried when the task is
    // either executed (has an action_block — completion lives on action) or
    // shelved (ADR-026: intentionally parked, off the carry-over conveyor).
    const skipTaskIds = new Set(actions.map((a) => a.taskId));
    for (const id of shelvedTaskIds(tasks)) skipTaskIds.add(id);

    const today = startOfDay(new Date());
    for (const plan of findOverduePlans(plans, today, skipTaskIds)) {
      const { missedPatch, nextPlan } = carryOverPlan(plan, today, gridEndHour);
      updatePlanBlock.mutate({ planBlockId: plan.planBlockId, patch: missedPatch });
      addPlanBlock.mutate(nextPlan);
    }
  }, [
    plansReady,
    plans,
    actionsReady,
    actions,
    tasksReady,
    tasks,
    gridEndHour,
    updatePlanBlock,
    addPlanBlock,
  ]);
}
