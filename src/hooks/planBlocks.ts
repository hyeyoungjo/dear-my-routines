"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { PlanBlock } from "@/core/time/plan";

/**
 * TanStack Query hooks for `plan_blocks` — a task's per-day intentions (ADR-015).
 * The cache holds the flat `PlanBlock[]` exactly as `/api/plan-blocks` returns it
 * (timestamps as ISO strings, gridDay as YYYY-MM-DD), so server sync is a plain
 * overwrite. Every mutation updates that cache *optimistically* — the screen
 * changes the instant the user acts, never waiting for the round-trip — and
 * rolls back on error (ADR-007, CLAUDE.md CRITICAL).
 *
 * No undo wiring (ADR-015 removes undo): mutations are plain optimistic writes.
 */

/** Shared query key for the flat plan list. */
export const planBlocksKey = ["plan-blocks"] as const;

// --- Fetchers -------------------------------------------------------------

async function fetchPlanBlocks(): Promise<PlanBlock[]> {
  const res = await fetch("/api/plan-blocks");
  if (!res.ok) throw new Error(`Failed to load plan blocks (${res.status})`);
  return res.json();
}

/** Fields a client may supply when creating a plan (server injects userId). */
export type AddPlanInput = Pick<
  PlanBlock,
  "nodeId" | "gridDay" | "startAt" | "endAt"
> &
  Partial<Pick<PlanBlock, "status">>;

async function createPlanBlock(input: AddPlanInput): Promise<PlanBlock> {
  const res = await fetch("/api/plan-blocks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`Failed to create plan block (${res.status})`);
  return res.json();
}

export type UpdatePlanInput = { id: string; patch: Partial<PlanBlock> };

async function patchPlanBlock({ id, patch }: UpdatePlanInput): Promise<PlanBlock> {
  const res = await fetch(`/api/plan-blocks/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`Failed to update plan block (${res.status})`);
  return res.json();
}

async function deletePlanBlock(id: string): Promise<{ id: string }> {
  const res = await fetch(`/api/plan-blocks/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`Failed to delete plan block (${res.status})`);
  return res.json();
}

// --- Query ----------------------------------------------------------------

/** Load all of the user's plan_blocks as a flat array. */
export function usePlanBlocks() {
  return useQuery({ queryKey: planBlocksKey, queryFn: fetchPlanBlocks });
}

// --- Optimistic mutation core ---------------------------------------------

type OptimisticContext = { previous: PlanBlock[] | undefined };

/**
 * Wire one mutation with the standard optimistic lifecycle: cancel in-flight
 * reads, snapshot the cache, apply `updater` immediately, roll back on error,
 * and invalidate on settle to reconcile with the server.
 */
function useOptimisticPlanMutation<TVars, TData>(
  mutationFn: (vars: TVars) => Promise<TData>,
  updater: (plans: PlanBlock[], vars: TVars) => PlanBlock[],
) {
  const queryClient = useQueryClient();

  return useMutation<TData, Error, TVars, OptimisticContext>({
    mutationFn,
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: planBlocksKey });
      const previous = queryClient.getQueryData<PlanBlock[]>(planBlocksKey);
      queryClient.setQueryData<PlanBlock[]>(planBlocksKey, (old) =>
        updater(old ?? [], vars),
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context) queryClient.setQueryData(planBlocksKey, context.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: planBlocksKey });
    },
  });
}

/** Build a placeholder plan for the optimistic add (replaced on invalidate). */
function optimisticPlan(input: AddPlanInput): PlanBlock {
  return {
    id: crypto.randomUUID(),
    nodeId: input.nodeId,
    gridDay: input.gridDay,
    startAt: input.startAt,
    endAt: input.endAt,
    status: input.status ?? "planned",
  };
}

// --- Mutation hooks -------------------------------------------------------

/** Create a plan — optimistically appended to the flat cache. */
export function useAddPlanBlock() {
  return useOptimisticPlanMutation<AddPlanInput, PlanBlock>(
    createPlanBlock,
    (plans, input) => [...plans, optimisticPlan(input)],
  );
}

/** Patch a plan's fields — optimistically merged into the cached row. */
export function useUpdatePlanBlock() {
  return useOptimisticPlanMutation<UpdatePlanInput, PlanBlock>(
    patchPlanBlock,
    (plans, { id, patch }) =>
      plans.map((plan) => (plan.id === id ? { ...plan, ...patch } : plan)),
  );
}

/** Remove a plan — optimistically filtered out of the flat cache. */
export function useRemovePlanBlock() {
  return useOptimisticPlanMutation<string, { id: string }>(
    deletePlanBlock,
    (plans, id) => plans.filter((plan) => plan.id !== id),
  );
}
