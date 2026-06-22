"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
} from "@tanstack/react-query";
import { useRef } from "react";
import { useUndo, type UndoCommand } from "@/components/undo";
import type { FlatBlock } from "@/core/time/blocks";

/**
 * TanStack Query hooks for `task_blocks` — a task's per-day occurrences
 * (ADR-014). Coexists with the `nodes` hooks (hooks/nodes); the calendar still
 * reads nodes until step 3.
 *
 * The cache holds the flat `FlatBlock[]` exactly as `/api/blocks` returns it
 * (timestamps as ISO strings, gridDay as YYYY-MM-DD), so server sync is a plain
 * overwrite. Every mutation updates that cache *optimistically* — the screen
 * changes the instant the user acts, never waiting for the round-trip — and
 * rolls back on error (ADR-007, CLAUDE.md CRITICAL). A block list is flat, so
 * cache edits are plain array ops (no tree logic).
 */

/** Shared query key for the flat block list. */
export const blocksKey = ["blocks"] as const;

// --- Fetchers -------------------------------------------------------------

async function fetchBlocks(): Promise<FlatBlock[]> {
  const res = await fetch("/api/blocks");
  if (!res.ok) throw new Error(`Failed to load blocks (${res.status})`);
  return res.json();
}

/** Fields a client may supply when creating a block (server injects userId). */
export type AddBlockInput = Pick<FlatBlock, "nodeId" | "gridDay"> &
  Partial<
    Pick<
      FlatBlock,
      | "plannedStart"
      | "plannedEnd"
      | "actualStart"
      | "actualEnd"
      | "status"
      | "sortOrder"
    >
  > & {
    /** True when replayed by undo/redo — suppresses re-recording (see undo.tsx). */
    fromHistory?: boolean;
  };

async function createBlock(input: AddBlockInput): Promise<FlatBlock> {
  const res = await fetch("/api/blocks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`Failed to create block (${res.status})`);
  return res.json();
}

export type UpdateBlockInput = {
  id: string;
  patch: Partial<FlatBlock>;
  fromHistory?: boolean;
};

async function patchBlock({ id, patch }: UpdateBlockInput): Promise<FlatBlock> {
  const res = await fetch(`/api/blocks/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`Failed to update block (${res.status})`);
  return res.json();
}

async function deleteBlock(id: string): Promise<{ id: string }> {
  const res = await fetch(`/api/blocks/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`Failed to delete block (${res.status})`);
  return res.json();
}

// --- Query ----------------------------------------------------------------

/** Load all of the user's task_blocks as a flat array. */
export function useBlocks() {
  return useQuery({ queryKey: blocksKey, queryFn: fetchBlocks });
}

// --- Optimistic mutation core ---------------------------------------------

type OptimisticContext = { previous: FlatBlock[] | undefined };

/**
 * Wire one mutation with the standard optimistic lifecycle: cancel in-flight
 * reads, snapshot the cache, apply `updater` immediately, roll back on error,
 * and invalidate on settle to reconcile with the server. Mirrors
 * hooks/nodes `useOptimisticNodeMutation` for the `["blocks"]` cache.
 */
function useOptimisticBlockMutation<TVars, TData>(
  mutationFn: (vars: TVars) => Promise<TData>,
  updater: (blocks: FlatBlock[], vars: TVars) => FlatBlock[],
  // Build the inverse command from the just-applied mutation. Runs on success
  // (so a rolled-back edit is never recorded) and is skipped when the mutation
  // is itself an undo/redo replay (vars.fromHistory).
  recordCommand?: (
    vars: TVars,
    previous: FlatBlock[] | undefined,
    data: TData,
  ) => UndoCommand | null,
): UseMutationResult<TData, Error, TVars, OptimisticContext> {
  const queryClient = useQueryClient();
  const { record } = useUndo();

  return useMutation<TData, Error, TVars, OptimisticContext>({
    mutationFn,
    onMutate: async (vars) => {
      // Stop in-flight refetches from clobbering our optimistic write.
      await queryClient.cancelQueries({ queryKey: blocksKey });
      const previous = queryClient.getQueryData<FlatBlock[]>(blocksKey);
      queryClient.setQueryData<FlatBlock[]>(blocksKey, (old) =>
        updater(old ?? [], vars),
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context) queryClient.setQueryData(blocksKey, context.previous);
    },
    onSuccess: (data, vars, context) => {
      const fromHistory = (vars as { fromHistory?: boolean })?.fromHistory;
      if (fromHistory || !recordCommand) return;
      const cmd = recordCommand(vars, context?.previous, data);
      if (cmd) record(cmd);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: blocksKey });
    },
  });
}

/** Build a placeholder block for the optimistic add (replaced on invalidate). */
function optimisticBlock(input: AddBlockInput): FlatBlock {
  return {
    id: crypto.randomUUID(),
    nodeId: input.nodeId,
    gridDay: input.gridDay,
    plannedStart: input.plannedStart ?? null,
    plannedEnd: input.plannedEnd ?? null,
    actualStart: input.actualStart ?? null,
    actualEnd: input.actualEnd ?? null,
    status: input.status ?? "planned",
    sortOrder: input.sortOrder ?? 0,
  };
}

// --- Mutation hooks -------------------------------------------------------

/** Create a block — optimistically appended to the flat cache. */
export function useAddBlock() {
  const ref =
    useRef<UseMutationResult<
      FlatBlock,
      Error,
      AddBlockInput,
      OptimisticContext
    > | null>(null);
  const removeBlock = useRemoveBlock();
  const mutation = useOptimisticBlockMutation<AddBlockInput, FlatBlock>(
    createBlock,
    (blocks, input) => [...blocks, optimisticBlock(input)],
    (vars, _previous, created) => {
      // Undo deletes the created block; redo re-adds (a fresh id) and tracks it
      // so a subsequent undo still removes the right row.
      let createdId = created.id;
      return {
        undo: () => removeBlock.mutate(createdId),
        redo: () =>
          ref.current?.mutate(
            { ...vars, fromHistory: true },
            { onSuccess: (re) => (createdId = re.id) },
          ),
      };
    },
  );
  ref.current = mutation;
  return mutation;
}

/** Patch a block's fields — optimistically merged into the cached row. */
export function useUpdateBlock() {
  const ref =
    useRef<UseMutationResult<
      FlatBlock,
      Error,
      UpdateBlockInput,
      OptimisticContext
    > | null>(null);
  const mutation = useOptimisticBlockMutation<UpdateBlockInput, FlatBlock>(
    patchBlock,
    (blocks, { id, patch }) =>
      blocks.map((block) => (block.id === id ? { ...block, ...patch } : block)),
    ({ id, patch }, previous) => {
      const prev = previous?.find((b) => b.id === id);
      if (!prev) return null;
      // Inverse = the same keys, set back to their pre-edit values.
      const inverse: Partial<FlatBlock> = {};
      for (const key of Object.keys(patch)) {
        (inverse as Record<string, unknown>)[key] =
          prev[key as keyof FlatBlock];
      }
      return {
        undo: () =>
          ref.current?.mutate({ id, patch: inverse, fromHistory: true }),
        redo: () => ref.current?.mutate({ id, patch, fromHistory: true }),
      };
    },
  );
  ref.current = mutation;
  return mutation;
}

/** Remove a block — optimistically filtered out of the flat cache. */
export function useRemoveBlock() {
  return useOptimisticBlockMutation<string, { id: string }>(
    deleteBlock,
    (blocks, id) => blocks.filter((block) => block.id !== id),
  );
}
