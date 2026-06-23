"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { DailyReview } from "@/db/schema";

/**
 * TanStack Query hooks for `daily_reviews` — one journal per grid day
 * (ADR-004/006). There is exactly one review per date, so the cache is keyed
 * *per date* (`["daily-review", date]`) — a write to one day never invalidates
 * or re-renders another. The upsert is *optimistic*: the textarea reflects the
 * new text the instant the user types it, never waiting for the round-trip, and
 * rolls back on error (ADR-007, CLAUDE.md CRITICAL).
 *
 * `ai_analysis` is out of scope this phase: the route never overwrites it and
 * the optimistic row leaves it `null`.
 */

/** Per-date query key — keep days isolated from one another. */
export function dailyReviewKey(date: string) {
  return ["daily-review", date] as const;
}

// --- Fetcher --------------------------------------------------------------

async function fetchDailyReview(date: string): Promise<DailyReview | null> {
  const res = await fetch(`/api/daily-reviews?date=${date}`);
  if (!res.ok) throw new Error(`Failed to load daily review (${res.status})`);
  // The server returns the row or `null` (200) when none exists.
  return res.json();
}

/** Fields a client supplies for the upsert (server injects userId). */
export type UpsertReviewInput = { date: string; journalText: string };

async function upsertDailyReview(
  input: UpsertReviewInput,
): Promise<DailyReview> {
  const res = await fetch("/api/daily-reviews", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`Failed to save daily review (${res.status})`);
  return res.json();
}

// --- Query ----------------------------------------------------------------

/** Load the review for one grid day. `data === null` when none exists yet. */
export function useDailyReview(date: string) {
  return useQuery({
    queryKey: dailyReviewKey(date),
    queryFn: () => fetchDailyReview(date),
  });
}

// --- Analyze mutation (non-optimistic: result unknown until AI responds) ----

async function analyzeDay(input: { date: string }): Promise<DailyReview> {
  const res = await fetch("/api/daily-reviews/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`Analysis failed (${res.status})`);
  return res.json();
}

/**
 * Trigger AI analysis for a grid day. Not optimistic — the result is unknown
 * until the model responds. On success, writes the returned row into the cache
 * so the result appears immediately without a refetch.
 */
export function useAnalyzeDay() {
  const queryClient = useQueryClient();
  return useMutation<DailyReview, Error, { date: string }>({
    mutationFn: analyzeDay,
    onSuccess: (data, { date }) => {
      queryClient.setQueryData<DailyReview | null>(dailyReviewKey(date), data);
    },
    onError: (_err, { date }) => {
      queryClient.invalidateQueries({ queryKey: dailyReviewKey(date) });
    },
  });
}

// --- Optimistic upsert ----------------------------------------------------

type OptimisticContext = { previous: DailyReview | null | undefined };

/**
 * Apply the new journal text to the cached row immediately: merge into the
 * existing row if present, else fabricate a placeholder row (id/createdAt are
 * replaced when `onSettled` re-syncs with the server; `aiAnalysis` stays null).
 */
function optimisticReview(
  previous: DailyReview | null | undefined,
  { date, journalText }: UpsertReviewInput,
): DailyReview {
  if (previous) return { ...previous, journalText };
  return {
    id: crypto.randomUUID(),
    userId: "",
    date,
    journalText,
    aiAnalysis: null,
    createdAt: new Date(),
  };
}

/** Upsert the journal text for a grid day — optimistic, per-date cache. */
export function useUpsertDailyReview() {
  const queryClient = useQueryClient();

  return useMutation<DailyReview, Error, UpsertReviewInput, OptimisticContext>({
    mutationFn: upsertDailyReview,
    onMutate: async (input) => {
      const key = dailyReviewKey(input.date);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<DailyReview | null>(key);
      queryClient.setQueryData<DailyReview | null>(key, (old) =>
        optimisticReview(old, input),
      );
      return { previous };
    },
    onError: (_err, input, context) => {
      if (context) {
        queryClient.setQueryData(dailyReviewKey(input.date), context.previous);
      }
    },
    onSettled: (_data, _err, input) => {
      queryClient.invalidateQueries({ queryKey: dailyReviewKey(input.date) });
    },
  });
}
