// TODO(step-1): replace with zod schema once `zod` is installed.
// The type and guard below are manually kept in sync with dailyAnalysisSchema.

export type DailyAnalysis = {
  summary: string;
  observations: string[];
  encouragement: string;
  generatedAt?: string;
};

/** Narrow an `unknown` jsonb value to DailyAnalysis without crashing. */
export function isDailyAnalysis(value: unknown): value is DailyAnalysis {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.summary === "string" &&
    Array.isArray(v.observations) &&
    (v.observations as unknown[]).every((o) => typeof o === "string") &&
    typeof v.encouragement === "string"
  );
}
