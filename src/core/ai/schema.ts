import { z } from "zod";

/**
 * Shape of a daily AI review. This is the single source of truth: the AI SDK
 * validates the model output against it, and we reuse it to narrow jsonb read
 * back from the DB. `generatedAt` is stamped server-side after generation, so
 * it is not part of what the model produces.
 */
export const dailyAnalysisSchema = z.object({
  summary: z.string(),
  observations: z.array(z.string()),
  encouragement: z.string(),
});

export type DailyAnalysis = z.infer<typeof dailyAnalysisSchema> & {
  generatedAt?: string;
};

/** Narrow an `unknown` jsonb value to DailyAnalysis without crashing. */
export function isDailyAnalysis(value: unknown): value is DailyAnalysis {
  return dailyAnalysisSchema.safeParse(value).success;
}
