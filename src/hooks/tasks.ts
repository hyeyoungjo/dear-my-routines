"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Task } from "@/db/schema";

/**
 * TanStack Query hooks for `tasks` (ADR-016) — the identity + stats unit. The
 * cache holds the flat `Task[]` exactly as `/api/tasks` returns it. Every
 * mutation updates that cache *optimistically* and rolls back on error (ADR-007,
 * CLAUDE.md CRITICAL). No undo (ADR-015), no tree (tasks are flat under an
 * optional project).
 */

/** Shared query key for the flat task list. */
export const tasksKey = ["tasks"] as const;

// --- Fetchers -------------------------------------------------------------

async function fetchTasks(): Promise<Task[]> {
  const res = await fetch("/api/tasks");
  if (!res.ok) throw new Error(`Failed to load tasks (${res.status})`);
  return res.json();
}

/** Fields a client may supply when creating a task (server injects userId). */
export type AddTaskInput = Pick<Task, "title"> &
  Partial<Pick<Task, "projectId" | "notes" | "category">>;

async function createTask(input: AddTaskInput): Promise<Task> {
  const res = await fetch("/api/tasks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`Failed to create task (${res.status})`);
  return res.json();
}

export type UpdateTaskInput = { taskId: string; patch: Partial<Task> };

async function patchTask({ taskId, patch }: UpdateTaskInput): Promise<Task> {
  const res = await fetch(`/api/tasks/${taskId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`Failed to update task (${res.status})`);
  return res.json();
}

async function deleteTask(taskId: string): Promise<{ taskId: string }> {
  const res = await fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`Failed to delete task (${res.status})`);
  return res.json();
}

// --- Query ----------------------------------------------------------------

/** Load all of the user's tasks as a flat array. */
export function useTasks() {
  return useQuery({ queryKey: tasksKey, queryFn: fetchTasks });
}

// --- Optimistic mutation core ---------------------------------------------

type OptimisticContext = { previous: Task[] | undefined };

function useOptimisticTaskMutation<TVars, TData>(
  mutationFn: (vars: TVars) => Promise<TData>,
  updater: (tasks: Task[], vars: TVars) => Task[],
) {
  const queryClient = useQueryClient();

  return useMutation<TData, Error, TVars, OptimisticContext>({
    mutationFn,
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: tasksKey });
      const previous = queryClient.getQueryData<Task[]>(tasksKey);
      queryClient.setQueryData<Task[]>(tasksKey, (old) =>
        updater(old ?? [], vars),
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context) queryClient.setQueryData(tasksKey, context.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: tasksKey });
    },
  });
}

/** Build a placeholder task for the optimistic add (replaced on invalidate). */
function optimisticTask(input: AddTaskInput): Task {
  const now = new Date();
  return {
    taskId: crypto.randomUUID(),
    userId: "", // unknown on the client; the server is the source of truth.
    projectId: input.projectId ?? null,
    title: input.title,
    notes: input.notes ?? null,
    category: input.category ?? null,
    createdOn: now,
    updatedOn: now,
  };
}

// --- Mutation hooks -------------------------------------------------------

/** Create a task — optimistically appended to the flat cache. */
export function useAddTask() {
  return useOptimisticTaskMutation<AddTaskInput, Task>(
    createTask,
    (tasks, input) => [...tasks, optimisticTask(input)],
  );
}

/** Patch a task's fields — optimistically merged into the cached row. */
export function useUpdateTask() {
  return useOptimisticTaskMutation<UpdateTaskInput, Task>(
    patchTask,
    (tasks, { taskId, patch }) =>
      tasks.map((t) => (t.taskId === taskId ? { ...t, ...patch } : t)),
  );
}

/** Remove a task — optimistically filtered out of the flat cache. */
export function useRemoveTask() {
  return useOptimisticTaskMutation<string, { taskId: string }>(
    deleteTask,
    (tasks, taskId) => tasks.filter((t) => t.taskId !== taskId),
  );
}
