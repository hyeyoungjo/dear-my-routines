import { z } from "zod";

/**
 * Shape of a daily AI review. This is the single source of truth: the AI SDK
 * validates the model output against it, and we reuse it to narrow jsonb read
 * back from the DB. `generatedAt` and `taskRatios` are stamped server-side after
 * generation, so they are not part of what the model produces.
 */
export const dailyAnalysisSchema = z.object({
  summary: z.string(),
  observations: z.array(z.string()),
  encouragement: z.string(),
});

export type TaskRatio = {
  name: string;
  estimated: string;
  actual: string;
  isPartial?: boolean;
  isDeferred?: boolean;
};

export type DailyAnalysis = z.infer<typeof dailyAnalysisSchema> & {
  taskRatios?: TaskRatio[];
  generatedAt?: string;
};

/** Narrow an `unknown` jsonb value to DailyAnalysis without crashing. */
export function isDailyAnalysis(value: unknown): value is DailyAnalysis {
  return dailyAnalysisSchema.safeParse(value).success;
}
