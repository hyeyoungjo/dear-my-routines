"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { UserSettings } from "@/db/schema";

/**
 * TanStack Query hooks for `user_settings` — one row per user (ADR-020).
 * The AI model update is optimistic: the dropdown reflects the new value
 * immediately without waiting for the server (ADR-007).
 */

export const userSettingsKey = ["user-settings"] as const;

// API never returns encrypted_api_key — instead it exposes hasApiKey + role.
export type PublicUserSettings = Omit<UserSettings, "encryptedApiKey"> & {
  hasApiKey: boolean;
  role: "admin" | "tester" | "user";
};

// --- Fetcher ---------------------------------------------------------------

async function fetchUserSettings(): Promise<PublicUserSettings | null> {
  const res = await fetch("/api/user-settings");
  if (!res.ok) throw new Error(`Failed to load user settings (${res.status})`);
  return res.json();
}

export type UpdateSettingsInput = {
  aiModel?: string | null;
  aiEnabled?: boolean;
  language?: string | null;
  font?: string | null;
  gridStartTime?: number | null;
  gridEndTime?: number | null;
  // Pass a non-empty string to save, null to clear, undefined to leave unchanged.
  apiKey?: string | null;
};

async function updateUserSettings(
  input: UpdateSettingsInput,
): Promise<PublicUserSettings> {
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

type OptimisticContext = { previous: PublicUserSettings | null | undefined };

export function useUpdateUserSettings() {
  const queryClient = useQueryClient();

  return useMutation<
    PublicUserSettings,
    Error,
    UpdateSettingsInput,
    OptimisticContext
  >({
    mutationFn: updateUserSettings,
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: userSettingsKey });
      const previous =
        queryClient.getQueryData<PublicUserSettings | null>(userSettingsKey);
      queryClient.setQueryData<PublicUserSettings | null>(userSettingsKey, (old) => {
        // Optimistically reflect apiKey presence without exposing the value.
        const hasApiKey =
          input.apiKey === null ? false
          : input.apiKey !== undefined ? true
          : old?.hasApiKey ?? false;
        if (old) return { ...old, ...input, hasApiKey };
        // placeholder when no row exists yet
        return {
          id: crypto.randomUUID(),
          userId: "",
          aiModel: input.aiModel ?? null,
          aiEnabled: input.aiEnabled ?? false,
          language: input.language ?? null,
          font: input.font ?? null,
          gridStartTime: input.gridStartTime ?? null,
          gridEndTime: input.gridEndTime ?? null,
          hasApiKey,
          role: "user" as const,
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
