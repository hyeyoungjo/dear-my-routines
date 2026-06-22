"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
} from "@tanstack/react-query";
import { useRef } from "react";
import { useUndo, type UndoCommand } from "@/components/undo";
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
      | "category"
      | "isBig3"
      | "sortOrder"
    >
  > & {
    /** True when replayed by undo/redo — suppresses re-recording (see undo.tsx). */
    fromHistory?: boolean;
  };

async function createNode(input: AddNodeInput): Promise<FlatNode> {
  const res = await fetch("/api/nodes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`Failed to create node (${res.status})`);
  return res.json();
}

export type UpdateNodeInput = {
  id: string;
  patch: Partial<NewNode>;
  fromHistory?: boolean;
};

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
  fromHistory?: boolean;
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
  // Build the inverse command from the just-applied mutation. Runs on success
  // (so a failed/rolled-back edit is never recorded) and is skipped when the
  // mutation is itself an undo/redo replay (vars.fromHistory).
  recordCommand?: (
    vars: TVars,
    previous: FlatNode[] | undefined,
    data: TData,
  ) => UndoCommand | null,
): UseMutationResult<TData, Error, TVars, OptimisticContext> {
  const queryClient = useQueryClient();
  const { record } = useUndo();

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
    onSuccess: (data, vars, context) => {
      const fromHistory = (vars as { fromHistory?: boolean })?.fromHistory;
      if (fromHistory || !recordCommand) return;
      const cmd = recordCommand(vars, context?.previous, data);
      if (cmd) record(cmd);
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
    category: input.category ?? null,
    color: null,
    isBig3: input.isBig3 ?? false,
    sortOrder: input.sortOrder ?? 0,
    createdAt: now,
    updatedAt: now,
  };
}

// --- Mutation hooks -------------------------------------------------------

/** Create a node — optimistically appended via `core/tree` addNode. */
export function useAddNode() {
  const ref =
    useRef<UseMutationResult<
      FlatNode,
      Error,
      AddNodeInput,
      OptimisticContext
    > | null>(null);
  const removeNode = useRemoveNode();
  const mutation = useOptimisticNodeMutation<AddNodeInput, FlatNode>(
    createNode,
    (nodes, input) => addNode(nodes, optimisticNode(input)),
    (vars, _previous, created) => {
      // Undo deletes the created node; redo re-adds (a fresh id) and tracks it
      // so a subsequent undo still removes the right row.
      let createdId = created.id;
      return {
        undo: () => removeNode.mutate(createdId),
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

/** Patch a node's fields — optimistically merged into the cached row. */
export function useUpdateNode() {
  const ref =
    useRef<UseMutationResult<
      FlatNode,
      Error,
      UpdateNodeInput,
      OptimisticContext
    > | null>(null);
  const mutation = useOptimisticNodeMutation<UpdateNodeInput, FlatNode>(
    patchNode,
    (nodes, { id, patch }) =>
      nodes.map((node) => (node.id === id ? { ...node, ...patch } : node)),
    ({ id, patch }, previous) => {
      const prev = previous?.find((n) => n.id === id);
      if (!prev) return null;
      // Inverse = the same keys, set back to their pre-edit values.
      const inverse: Partial<NewNode> = {};
      for (const key of Object.keys(patch)) {
        (inverse as Record<string, unknown>)[key] =
          prev[key as keyof FlatNode];
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
  const ref =
    useRef<UseMutationResult<
      FlatNode,
      Error,
      MoveNodeInput,
      OptimisticContext
    > | null>(null);
  const mutation = useOptimisticNodeMutation<MoveNodeInput, FlatNode>(
    ({ id, newParentId, newIndex }) =>
      patchNode({ id, patch: { parentId: newParentId, sortOrder: newIndex } }),
    (nodes, { id, newParentId, newIndex }) =>
      moveNode(nodes, id, newParentId, newIndex),
    (vars, previous) => {
      const prev = previous?.find((n) => n.id === vars.id);
      if (!prev) return null;
      // Inverse = move back to the original parent and sibling position.
      return {
        undo: () =>
          ref.current?.mutate({
            id: vars.id,
            newParentId: prev.parentId,
            newIndex: prev.sortOrder,
            fromHistory: true,
          }),
        redo: () => ref.current?.mutate({ ...vars, fromHistory: true }),
      };
    },
  );
  ref.current = mutation;
  return mutation;
}
