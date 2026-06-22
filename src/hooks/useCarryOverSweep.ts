"use client";

import { useEffect, useRef } from "react";
import { carryOverBlock, findOverdueBlocks } from "@/core/time/blocks";
import { startOfDay } from "@/core/time/day";
import { useAddBlock, useBlocks, useUpdateBlock } from "@/hooks/blocks";

/**
 * Day-boundary auto carry-over (PRD-4, ADR-009/014): when the app loads, past-due
 * undone *blocks* are pulled forward to *today* so they resurface in Plan without
 * the user lifting a finger. ADR-014 reshapes the unit — a carry is no longer an
 * in-place edit of one node row but "leave this block `missed` + birth a new
 * planned block on today" (`carryOverBlock`). This is the silent system sweep —
 * no UX weight, no undo footprint (ADR-009 "UX 부담 0").
 *
 * It runs **once per mount**, the first time `useBlocks` resolves. Two layers keep
 * `carryCount` from ballooning if the effect re-fires (Strict Mode double mount,
 * the optimistic writes mutating the `blocks` cache, a settle refetch):
 *  1. `findOverdueBlocks` only returns blocks still `planned` on a grid day before
 *     today, so a block already carried (now `missed`) or the fresh block already
 *     on today is never a candidate again (blocks.ts, step 1).
 *  2. `sweptRef` flips to true *before* any mutation, so a second effect run on
 *     the same mount returns early — the sweep fires exactly once.
 *
 * Each carry goes through the optimistic `useUpdateBlock` (mark missed) +
 * `useAddBlock` (the new planned block) pipelines (no direct fetch — ADR-007),
 * both with `fromHistory: true`, so the system's tidy-up never lands on the Cmd+Z
 * stack (it isn't a user action to undo).
 */
export function useCarryOverSweep(): void {
  const { data: blocks, isSuccess } = useBlocks();
  const updateBlock = useUpdateBlock();
  const addBlock = useAddBlock();
  const sweptRef = useRef(false);

  useEffect(() => {
    if (sweptRef.current) return;
    if (!isSuccess || !blocks) return;
    // Guard BEFORE mutating: a re-run on this mount (Strict Mode, cache change)
    // must find the sweep already done and bail — else carryCount balloons.
    sweptRef.current = true;

    const today = startOfDay(new Date());
    for (const block of findOverdueBlocks(blocks, today)) {
      const { missedPatch, nextBlock } = carryOverBlock(block, today);
      updateBlock.mutate({ id: block.id, patch: missedPatch, fromHistory: true });
      addBlock.mutate({ ...nextBlock, fromHistory: true });
    }
  }, [isSuccess, blocks, updateBlock, addBlock]);
}
