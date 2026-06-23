"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { UserSettings } from "@/db/schema";

/**
 * TanStack Query hooks for `user_settings` — one row per user (ADR-020).
 * The AI model update is optimistic: the dropdown reflects the new value
 * immediately without waiting for the server (ADR-007).
 */

export const userSettingsKey = ["user-settings"] as const;

// --- Fetcher ---------------------------------------------------------------

async function fetchUserSettings(): Promise<UserSettings | null> {
  const res = await fetch("/api/user-settings");
  if (!res.ok) throw new Error(`Failed to load user settings (${res.status})`);
  return res.json();
}

export type UpdateSettingsInput = {
  aiModel?: string | null;
  aiEnabled?: boolean;
};

async function updateUserSettings(
  input: UpdateSettingsInput,
): Promise<UserSettings> {
  const res = await fetch("/api/user-settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`Failed to save user settings (${res.status})`);
  return res.json();
}

// --- Query -----------------------------------------------------------------

export function useUserSettings() {
  return useQuery({
    queryKey: userSettingsKey,
    queryFn: fetchUserSettings,
  });
}

// --- Optimistic mutation ---------------------------------------------------

type OptimisticContext = { previous: UserSettings | null | undefined };

export function useUpdateUserSettings() {
  const queryClient = useQueryClient();

  return useMutation<
    UserSettings,
    Error,
    UpdateSettingsInput,
    OptimisticContext
  >({
    mutationFn: updateUserSettings,
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: userSettingsKey });
      const previous =
        queryClient.getQueryData<UserSettings | null>(userSettingsKey);
      queryClient.setQueryData<UserSettings | null>(userSettingsKey, (old) => {
        if (old) return { ...old, ...input };
        // placeholder when no row exists yet
        return {
          id: crypto.randomUUID(),
          userId: "",
          aiModel: input.aiModel ?? null,
          aiEnabled: input.aiEnabled ?? false,
          createdOn: new Date(),
          updatedOn: new Date(),
        };
      });
      return { previous };
    },
    onError: (_err, _input, context) => {
      if (context) {
        queryClient.setQueryData(userSettingsKey, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: userSettingsKey });
    },
  });
}
