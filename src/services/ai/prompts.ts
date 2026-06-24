import { readFile } from "node:fs/promises";
import path from "node:path";
import type { PromptTemplates } from "@/core/ai/dailyReviewPrompt";

/**
 * Loads the daily-review prompt templates from the `prompts/` folder so a
 * developer can tune the wording in markdown without touching code. Files are
 * read fresh on every call (an AI request is rare and expensive, so the read
 * cost is noise) — meaning edits take effect on the next analyze with no rebuild
 * or restart.
 *
 * `process.cwd()` is the project root under `next dev` and `next start`, and
 * path.join keeps this OS-agnostic (CLAUDE.md). UTF-8 is explicit.
 */
const PROMPTS_DIR = path.join(process.cwd(), "prompts");

export async function loadDailyReviewTemplates(): Promise<PromptTemplates> {
  const [system, user] = await Promise.all([
    readFile(path.join(PROMPTS_DIR, "daily-review.system.md"), "utf8"),
    readFile(path.join(PROMPTS_DIR, "daily-review.user.md"), "utf8"),
  ]);
  return { system, user };
}
