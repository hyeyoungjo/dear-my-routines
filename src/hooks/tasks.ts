"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Task } from "@/db/schema";
import type { PlanBlock } from "@/core/time/plan";
import type { ActionBlock } from "@/core/time/action";
import { planBlocksKey } from "./planBlocks";
import { actionBlocksKey } from "./actionBlocks";

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

/** Fields a client may supply when creating a task (server injects userId). The
 *  client may mint `taskId` so a task and its first block share it immediately. */
export type AddTaskInput = Pick<Task, "title"> &
  Partial<Pick<Task, "taskId" | "projectId" | "notes" | "category">>;

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
    taskId: input.taskId ?? crypto.randomUUID(),
    userId: "", // unknown on the client; the server is the source of truth.
    projectId: input.projectId ?? null,
    title: input.title,
    notes: input.notes ?? null,
    category: input.category ?? null,
    shelvedAt: null, // a freshly created task is always active (ADR-026)
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

// --- Create a task together with its first block --------------------------

/** A block span the client sends with a task create (ISO strings + grid day). */
type BlockSpanInput = { date: string; startAt: string; endAt: string };

export type CreateTaskWithBlockInput = {
  taskId: string;
  title: string;
  plan?: BlockSpanInput;
  action?: BlockSpanInput;
};

type CreateWithBlockResult = {
  task: Task;
  planBlock: PlanBlock | null;
  actionBlock: ActionBlock | null;
};

async function createTaskWithBlock(
  input: CreateTaskWithBlockInput,
): Promise<CreateWithBlockResult> {
  const res = await fetch("/api/tasks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`Failed to create task (${res.status})`);
  return res.json();
}

type WithBlockContext = {
  tasks: Task[] | undefined;
  plans: PlanBlock[] | undefined;
  actions: ActionBlock[] | undefined;
};

/**
 * Create a task AND its first plan/action block in ONE optimistic write and ONE
 * server round-trip (a transaction, FK-safe — ADR-007). The client mints the
 * `taskId` so the task and block share it from the first frame: the block renders
 * the instant the user clicks an empty slot, instead of waiting a round-trip for
 * the task's server id (the old onSuccess-chained create lagged that long). All
 * three caches (tasks + plan + action) roll back together on error.
 */
export function useCreateTaskWithBlock() {
  const queryClient = useQueryClient();
  return useMutation<
    CreateWithBlockResult,
    Error,
    CreateTaskWithBlockInput,
    WithBlockContext
  >({
    mutationFn: createTaskWithBlock,
    onMutate: async (input) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: tasksKey }),
        queryClient.cancelQueries({ queryKey: planBlocksKey }),
        queryClient.cancelQueries({ queryKey: actionBlocksKey }),
      ]);
      const previous: WithBlockContext = {
        tasks: queryClient.getQueryData<Task[]>(tasksKey),
        plans: queryClient.getQueryData<PlanBlock[]>(planBlocksKey),
        actions: queryClient.getQueryData<ActionBlock[]>(actionBlocksKey),
      };
      queryClient.setQueryData<Task[]>(tasksKey, (old) => [
        ...(old ?? []),
        optimisticTask({ taskId: input.taskId, title: input.title }),
      ]);
      const { plan, action } = input;
      if (plan) {
        queryClient.setQueryData<PlanBlock[]>(planBlocksKey, (old) => [
          ...(old ?? []),
          {
            planBlockId: crypto.randomUUID(),
            taskId: input.taskId,
            date: plan.date,
            startAt: plan.startAt,
            endAt: plan.endAt,
            status: "planned",
          },
        ]);
      }
      if (action) {
        queryClient.setQueryData<ActionBlock[]>(actionBlocksKey, (old) => [
          ...(old ?? []),
          {
            actionBlockId: crypto.randomUUID(),
            taskId: input.taskId,
            date: action.date,
            startAt: action.startAt,
            endAt: action.endAt,
            status: "done" as const,
          },
        ]);
      }
      return previous;
    },
    onError: (_err, _input, context) => {
      if (!context) return;
      queryClient.setQueryData(tasksKey, context.tasks);
      queryClient.setQueryData(planBlocksKey, context.plans);
      queryClient.setQueryData(actionBlocksKey, context.actions);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: tasksKey });
      queryClient.invalidateQueries({ queryKey: planBlocksKey });
      queryClient.invalidateQueries({ queryKey: actionBlocksKey });
    },
  });
}
