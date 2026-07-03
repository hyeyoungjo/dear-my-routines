"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ActionBlock } from "@/core/time/action";

/**
 * TanStack Query hooks for `action_blocks` — a task's actual executions
 * (ADR-015/016). The cache holds the flat `ActionBlock[]` exactly as
 * `/api/action-blocks` returns it (timestamps as ISO strings, date as
 * YYYY-MM-DD). Every mutation updates that cache *optimistically* and rolls back
 * on error (ADR-007, CLAUDE.md CRITICAL). No undo wiring (ADR-015).
 */

/** Shared query key for the flat action list. */
export const actionBlocksKey = ["action-blocks"] as const;

// --- Fetchers -------------------------------------------------------------

async function fetchActionBlocks(): Promise<ActionBlock[]> {
  const res = await fetch("/api/action-blocks");
  if (!res.ok) throw new Error(`Failed to load action blocks (${res.status})`);
  return res.json();
}

/** Fields a client may supply when creating an action (server injects userId). */
export type AddActionInput = Pick<ActionBlock, "taskId" | "date" | "startAt"> &
  Partial<Pick<ActionBlock, "endAt" | "planBlockId">>;

async function createActionBlock(input: AddActionInput): Promise<ActionBlock> {
  const res = await fetch("/api/action-blocks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`Failed to create action block (${res.status})`);
  return res.json();
}

export type UpdateActionInput = {
  actionBlockId: string;
  patch: Partial<ActionBlock>;
};

async function patchActionBlock({
  actionBlockId,
  patch,
}: UpdateActionInput): Promise<ActionBlock> {
  const res = await fetch(`/api/action-blocks/${actionBlockId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`Failed to update action block (${res.status})`);
  return res.json();
}

async function deleteActionBlock(
  actionBlockId: string,
): Promise<{ actionBlockId: string }> {
  const res = await fetch(`/api/action-blocks/${actionBlockId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(`Failed to delete action block (${res.status})`);
  return res.json();
}

// --- Query ----------------------------------------------------------------

/** Load all of the user's action_blocks as a flat array. */
export function useActionBlocks() {
  return useQuery({ queryKey: actionBlocksKey, queryFn: fetchActionBlocks });
}

// --- Optimistic mutation core ---------------------------------------------

type OptimisticContext = { previous: ActionBlock[] | undefined };

/**
 * Wire one mutation with the standard optimistic lifecycle: cancel in-flight
 * reads, snapshot the cache, apply `updater` immediately, roll back on error,
 * and invalidate on settle to reconcile with the server.
 */
function useOptimisticActionMutation<TVars, TData>(
  mutationFn: (vars: TVars) => Promise<TData>,
  updater: (actions: ActionBlock[], vars: TVars) => ActionBlock[],
) {
  const queryClient = useQueryClient();

  return useMutation<TData, Error, TVars, OptimisticContext>({
    mutationFn,
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: actionBlocksKey });
      const previous = queryClient.getQueryData<ActionBlock[]>(actionBlocksKey);
      queryClient.setQueryData<ActionBlock[]>(actionBlocksKey, (old) =>
        updater(old ?? [], vars),
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context) queryClient.setQueryData(actionBlocksKey, context.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: actionBlocksKey });
    },
  });
}

/** Build a placeholder action for the optimistic add (replaced on invalidate). */
function optimisticAction(input: AddActionInput): ActionBlock {
  return {
    actionBlockId: crypto.randomUUID(),
    taskId: input.taskId,
    // Carried into the placeholder so a confirmed ghost disappears in the same
    // frame (the grid suppresses a linked plan's ghost) — not on server settle.
    planBlockId: input.planBlockId ?? null,
    date: input.date,
    startAt: input.startAt,
    endAt: input.endAt ?? null,
    status: "done",
  };
}

// --- Mutation hooks -------------------------------------------------------

/** Create an action — optimistically appended to the flat cache. */
export function useAddActionBlock() {
  return useOptimisticActionMutation<AddActionInput, ActionBlock>(
    createActionBlock,
    (actions, input) => [...actions, optimisticAction(input)],
  );
}

/** Patch an action's fields — optimistically merged into the cached row. */
export function useUpdateActionBlock() {
  return useOptimisticActionMutation<UpdateActionInput, ActionBlock>(
    patchActionBlock,
    (actions, { actionBlockId, patch }) =>
      actions.map((action) =>
        action.actionBlockId === actionBlockId
          ? { ...action, ...patch }
          : action,
      ),
  );
}

/** Remove an action — optimistically filtered out of the flat cache. */
export function useRemoveActionBlock() {
  return useOptimisticActionMutation<string, { actionBlockId: string }>(
    deleteActionBlock,
    (actions, actionBlockId) =>
      actions.filter((action) => action.actionBlockId !== actionBlockId),
  );
}
