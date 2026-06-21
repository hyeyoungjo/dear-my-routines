"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
} from "@tanstack/react-query";
import { addNode, moveNode, removeNode } from "@/core/tree/tree";
import type { FlatNode } from "@/core/tree/types";
import type { NewNode } from "@/db/schema";

/**
 * TanStack Query hooks for the `nodes` tree (ADR-007, CLAUDE.md CRITICAL).
 *
 * The cache holds the flat `FlatNode[]` exactly as `/api/nodes` returns it, so
 * server sync is a plain overwrite. Every mutation updates that cache
 * *optimistically* — the screen changes the instant the user acts, never
 * waiting for the round-trip — and rolls back on error. All structural cache
 * edits reuse the pure `core/tree` functions (single source of truth — never
 * reimplement tree logic here).
 */

/** Shared query key for the flat node list. */
export const nodesKey = ["nodes"] as const;

// --- Fetchers -------------------------------------------------------------

async function fetchNodes(): Promise<FlatNode[]> {
  const res = await fetch("/api/nodes");
  if (!res.ok) throw new Error(`Failed to load nodes (${res.status})`);
  return res.json();
}

/** Fields a client may supply when creating a node (server injects userId). */
export type AddNodeInput = Pick<NewNode, "title" | "type"> &
  Partial<
    Pick<
      NewNode,
      | "parentId"
      | "notes"
      | "links"
      | "estimateMinutes"
      | "actualMinutes"
      | "status"
      | "category"
      | "isBig3"
      | "plannedDate"
      | "sortOrder"
    >
  >;

async function createNode(input: AddNodeInput): Promise<FlatNode> {
  const res = await fetch("/api/nodes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`Failed to create node (${res.status})`);
  return res.json();
}

export type UpdateNodeInput = { id: string; patch: Partial<NewNode> };

async function patchNode({ id, patch }: UpdateNodeInput): Promise<FlatNode> {
  const res = await fetch(`/api/nodes/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`Failed to update node (${res.status})`);
  return res.json();
}

async function deleteNode(id: string): Promise<{ id: string }> {
  const res = await fetch(`/api/nodes/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`Failed to delete node (${res.status})`);
  return res.json();
}

export type MoveNodeInput = {
  id: string;
  newParentId: string | null;
  newIndex: number;
};

// --- Query ----------------------------------------------------------------

/** Load all of the user's nodes as a flat array. Consumers nest with buildTree. */
export function useNodes() {
  return useQuery({ queryKey: nodesKey, queryFn: fetchNodes });
}

// --- Optimistic mutation core ---------------------------------------------

type OptimisticContext = { previous: FlatNode[] | undefined };

/**
 * Wire one mutation with the standard optimistic lifecycle: cancel in-flight
 * reads, snapshot the cache, apply `updater` immediately, roll back on error,
 * and invalidate on settle to reconcile with the server. Callers inject only
 * what differs — the server call (`mutationFn`) and the pure cache `updater`.
 */
function useOptimisticNodeMutation<TVars, TData>(
  mutationFn: (vars: TVars) => Promise<TData>,
  updater: (nodes: FlatNode[], vars: TVars) => FlatNode[],
): UseMutationResult<TData, Error, TVars, OptimisticContext> {
  const queryClient = useQueryClient();

  return useMutation<TData, Error, TVars, OptimisticContext>({
    mutationFn,
    onMutate: async (vars) => {
      // Stop in-flight refetches from clobbering our optimistic write.
      await queryClient.cancelQueries({ queryKey: nodesKey });
      const previous = queryClient.getQueryData<FlatNode[]>(nodesKey);
      queryClient.setQueryData<FlatNode[]>(nodesKey, (old) =>
        updater(old ?? [], vars),
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context) queryClient.setQueryData(nodesKey, context.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: nodesKey });
    },
  });
}

/** Build a placeholder node for the optimistic add (replaced on invalidate). */
function optimisticNode(input: AddNodeInput): FlatNode {
  const now = new Date();
  return {
    id: crypto.randomUUID(),
    userId: "", // unknown on the client; the server is the source of truth.
    parentId: input.parentId ?? null,
    type: input.type,
    title: input.title,
    notes: input.notes ?? null,
    links: input.links ?? null,
    estimateMinutes: input.estimateMinutes ?? null,
    actualMinutes: input.actualMinutes ?? null,
    status: input.status ?? "pending",
    category: input.category ?? null,
    isBig3: input.isBig3 ?? false,
    plannedDate: input.plannedDate ?? null,
    carryCount: 0,
    sortOrder: input.sortOrder ?? 0,
    createdAt: now,
    updatedAt: now,
  };
}

// --- Mutation hooks -------------------------------------------------------

/** Create a node — optimistically appended via `core/tree` addNode. */
export function useAddNode() {
  return useOptimisticNodeMutation<AddNodeInput, FlatNode>(
    createNode,
    (nodes, input) => addNode(nodes, optimisticNode(input)),
  );
}

/** Patch a node's fields — optimistically merged into the cached row. */
export function useUpdateNode() {
  return useOptimisticNodeMutation<UpdateNodeInput, FlatNode>(
    patchNode,
    (nodes, { id, patch }) =>
      nodes.map((node) => (node.id === id ? { ...node, ...patch } : node)),
  );
}

/** Remove a node and its descendants — optimistically via `core/tree` removeNode. */
export function useRemoveNode() {
  return useOptimisticNodeMutation<string, { id: string }>(
    deleteNode,
    (nodes, id) => removeNode(nodes, id),
  );
}

/**
 * Move a node under a new parent at `newIndex` — optimistically via `core/tree`
 * moveNode (which recomputes sibling `sortOrder`). The server PATCH is a
 * best-effort single-row update of `parentId`/`sortOrder`; full sibling
 * reordering on the server is reconciled by the invalidate on settle.
 */
export function useMoveNode() {
  return useOptimisticNodeMutation<MoveNodeInput, FlatNode>(
    ({ id, newParentId, newIndex }) =>
      patchNode({ id, patch: { parentId: newParentId, sortOrder: newIndex } }),
    (nodes, { id, newParentId, newIndex }) =>
      moveNode(nodes, id, newParentId, newIndex),
  );
}
