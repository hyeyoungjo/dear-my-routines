"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Project } from "@/db/schema";

/**
 * TanStack Query hooks for `projects` (ADR-016) — the top level of the fixed
 * two-level model. The cache holds the flat `Project[]` exactly as
 * `/api/projects` returns it. Every mutation updates that cache *optimistically*
 * and rolls back on error (ADR-007, CLAUDE.md CRITICAL). No undo (ADR-015).
 */

/** Shared query key for the flat project list. */
export const projectsKey = ["projects"] as const;

// --- Fetchers -------------------------------------------------------------

async function fetchProjects(): Promise<Project[]> {
  const res = await fetch("/api/projects");
  if (!res.ok) throw new Error(`Failed to load projects (${res.status})`);
  return res.json();
}

/** Fields a client may supply when creating a project (server injects userId). */
export type AddProjectInput = Pick<Project, "title"> &
  Partial<Pick<Project, "projectColor">>;

async function createProject(input: AddProjectInput): Promise<Project> {
  const res = await fetch("/api/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`Failed to create project (${res.status})`);
  return res.json();
}

export type UpdateProjectInput = { projectId: string; patch: Partial<Project> };

async function patchProject({
  projectId,
  patch,
}: UpdateProjectInput): Promise<Project> {
  const res = await fetch(`/api/projects/${projectId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`Failed to update project (${res.status})`);
  return res.json();
}

async function deleteProject(projectId: string): Promise<{ projectId: string }> {
  const res = await fetch(`/api/projects/${projectId}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`Failed to delete project (${res.status})`);
  return res.json();
}

// --- Query ----------------------------------------------------------------

/** Load all of the user's projects as a flat array. */
export function useProjects() {
  return useQuery({ queryKey: projectsKey, queryFn: fetchProjects });
}

// --- Optimistic mutation core ---------------------------------------------

type OptimisticContext = { previous: Project[] | undefined };

function useOptimisticProjectMutation<TVars, TData>(
  mutationFn: (vars: TVars) => Promise<TData>,
  updater: (projects: Project[], vars: TVars) => Project[],
) {
  const queryClient = useQueryClient();

  return useMutation<TData, Error, TVars, OptimisticContext>({
    mutationFn,
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: projectsKey });
      const previous = queryClient.getQueryData<Project[]>(projectsKey);
      queryClient.setQueryData<Project[]>(projectsKey, (old) =>
        updater(old ?? [], vars),
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context) queryClient.setQueryData(projectsKey, context.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: projectsKey });
    },
  });
}

/** Build a placeholder project for the optimistic add (replaced on invalidate). */
function optimisticProject(input: AddProjectInput): Project {
  const now = new Date();
  return {
    projectId: crypto.randomUUID(),
    userId: "", // unknown on the client; the server is the source of truth.
    title: input.title,
    projectColor: input.projectColor ?? null,
    createdOn: now,
    updatedOn: now,
  };
}

// --- Mutation hooks -------------------------------------------------------

/** Create a project — optimistically appended to the flat cache. */
export function useAddProject() {
  return useOptimisticProjectMutation<AddProjectInput, Project>(
    createProject,
    (projects, input) => [...projects, optimisticProject(input)],
  );
}

/** Patch a project's fields — optimistically merged into the cached row. */
export function useUpdateProject() {
  return useOptimisticProjectMutation<UpdateProjectInput, Project>(
    patchProject,
    (projects, { projectId, patch }) =>
      projects.map((p) => (p.projectId === projectId ? { ...p, ...patch } : p)),
  );
}

/** Remove a project — optimistically filtered out of the flat cache. */
export function useRemoveProject() {
  return useOptimisticProjectMutation<string, { projectId: string }>(
    deleteProject,
    (projects, projectId) =>
      projects.filter((p) => p.projectId !== projectId),
  );
}
