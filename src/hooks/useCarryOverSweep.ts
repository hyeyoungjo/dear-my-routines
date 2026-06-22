"use client";

import { useEffect, useRef } from "react";
import { carryOverNode, findOverdueUncarried } from "@/core/time/carry";
import { startOfDay } from "@/core/time/day";
import { useNodes, useUpdateNode } from "@/hooks/nodes";

/**
 * Day-boundary auto carry-over (PRD-4, ADR-009): when the app loads, past-due
 * undone tasks are pulled forward to *today* so they resurface in Plan without
 * the user lifting a finger. This is the silent system sweep — no UX weight, no
 * undo footprint (ADR-009 "UX 부담 0").
 *
 * It runs **once per mount**, the first time `useNodes` resolves. Two layers
 * keep `carryCount` from ballooning if the effect re-fires (Strict Mode double
 * mount, the optimistic writes mutating the `nodes` cache, a settle refetch):
 *  1. `findOverdueUncarried` excludes nodes already on today's grid day, so a
 *     node moved forward is never a candidate again (carry.ts, step 0).
 *  2. `sweptRef` flips to true *before* any mutation, so a second effect run on
 *     the same mount returns early — the sweep fires exactly once.
 *
 * Each carry goes through the optimistic `useUpdateNode` pipeline (no direct
 * fetch — ADR-007) with `fromHistory: true`, so the system's tidy-up never
 * lands on the Cmd+Z stack (it isn't a user action to undo).
 */
export function useCarryOverSweep(): void {
  const { data: nodes, isSuccess } = useNodes();
  const updateNode = useUpdateNode();
  const sweptRef = useRef(false);

  useEffect(() => {
    if (sweptRef.current) return;
    if (!isSuccess || !nodes) return;
    // Guard BEFORE mutating: a re-run on this mount (Strict Mode, cache change)
    // must find the sweep already done and bail — else carryCount balloons.
    sweptRef.current = true;

    const today = startOfDay(new Date());
    for (const node of findOverdueUncarried(nodes, today)) {
      updateNode.mutate({
        id: node.id,
        patch: carryOverNode(node, today),
        fromHistory: true,
      });
    }
  }, [isSuccess, nodes, updateNode]);
}
