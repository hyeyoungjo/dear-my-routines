"use client";

import { useEffect, useRef } from "react";
import { carryOverPlan, findOverduePlans } from "@/core/time/plan";
import { startOfDay } from "@/core/time/day";
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
  const { data: plans, isSuccess } = usePlanBlocks();
  const updatePlanBlock = useUpdatePlanBlock();
  const addPlanBlock = useAddPlanBlock();
  const sweptRef = useRef(false);

  useEffect(() => {
    if (sweptRef.current) return;
    if (!isSuccess || !plans) return;
    // Guard BEFORE mutating: a re-run on this mount (Strict Mode, cache change)
    // must find the sweep already done and bail — else carryCount balloons.
    sweptRef.current = true;

    const today = startOfDay(new Date());
    for (const plan of findOverduePlans(plans, today)) {
      const { missedPatch, nextPlan } = carryOverPlan(plan, today);
      updatePlanBlock.mutate({ planBlockId: plan.planBlockId, patch: missedPatch });
      addPlanBlock.mutate(nextPlan);
    }
  }, [isSuccess, plans, updatePlanBlock, addPlanBlock]);
}
