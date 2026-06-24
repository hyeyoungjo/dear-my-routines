import { durationMinutes } from "@/core/time/calendar";

/**
 * Pure prompt construction for the daily AI review (CLAUDE.md CRITICAL: AI
 * prompt assembly lives in core/ as pure functions, never in UI or a route).
 *
 * The two markdown templates are loaded from disk by the service layer
 * (services/ai/prompts) and passed in here, so this stays free of I/O and fully
 * testable. This file only computes the planned-vs-actual summary and fills the
 * `{{placeholder}}` slots — the heart of what makes a review concrete.
 */

/** One task's plan + action spans on the reviewed day (ISO-string timestamps). */
export type ReviewTaskInput = {
  taskTitle: string;
  projectTitle: string | null;
  category: string | null;
  /** Plan spans for the day — both edges always present (plan_blocks notNull). */
  plans: { startAt: string; endAt: string }[];
  /** Action spans — `endAt` null while still running (contributes no minutes). */
  actions: { startAt: string; endAt: string | null }[];
};

export type DailyReviewPromptInput = {
  date: string;
  journalText: string;
  tasks: ReviewTaskInput[];
  /** Native label of the user's UI language (e.g. "한국어") — the answer language. */
  language: string;
  /** Pre-summarized trailing-window patterns (see core/ai/reviewHistory). */
  history: string;
  /** User's free-text style guidance for the review (tone/wording only). */
  customStyle: string;
};

export type PromptTemplates = { system: string; user: string };

/** Per-task figures derived from its spans — the planned-vs-actual unit. */
type TaskSummary = {
  taskTitle: string;
  projectTitle: string | null;
  category: string | null;
  plannedMinutes: number;
  actualMinutes: number;
  done: boolean;
};

function summarizeTask(task: ReviewTaskInput): TaskSummary {
  const plannedMinutes = task.plans.reduce(
    (sum, p) => sum + durationMinutes(new Date(p.startAt), new Date(p.endAt)),
    0,
  );
  const actualMinutes = task.actions.reduce(
    (sum, a) =>
      a.endAt ? sum + durationMinutes(new Date(a.startAt), new Date(a.endAt)) : sum,
    0,
  );
  return {
    taskTitle: task.taskTitle,
    projectTitle: task.projectTitle,
    category: task.category,
    plannedMinutes,
    actualMinutes,
    done: task.actions.length > 0,
  };
}

/** Human-readable minutes: "0m", "45m", "2h 5m", "3h". */
export function formatMinutes(total: number): string {
  if (total < 60) return `${total}m`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/** One readable line per task, e.g.
 *  - "Write report" (Work · deep-work): planned 30m → actual 2h 5m — done
 */
function renderTaskLine(s: TaskSummary): string {
  const tags = [s.projectTitle, s.category].filter(Boolean).join(" · ");
  const context = tags ? ` (${tags})` : "";
  const state = s.done ? "done" : "not done";
  return `- "${s.taskTitle}"${context}: planned ${formatMinutes(
    s.plannedMinutes,
  )} → actual ${formatMinutes(s.actualMinutes)} — ${state}`;
}

function renderTasksTable(summaries: TaskSummary[]): string {
  if (summaries.length === 0) {
    return "(no tasks were planned or logged for this day)";
  }
  return summaries.map(renderTaskLine).join("\n");
}

/** Replace every `{{key}}` in `template` with `vars[key]` (missing → empty). */
function fillTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? "");
}

/**
 * Build the `{ system, prompt }` pair the AI SDK consumes. Both templates are
 * interpolated with the same vars, so a `{{placeholder}}` (notably
 * `{{language}}`) can be authored into either the system or user markdown.
 */
export function buildDailyReviewPrompt(
  input: DailyReviewPromptInput,
  templates: PromptTemplates,
): { system: string; prompt: string } {
  const summaries = input.tasks.map(summarizeTask);
  const totalPlanned = summaries.reduce((s, t) => s + t.plannedMinutes, 0);
  const totalActual = summaries.reduce((s, t) => s + t.actualMinutes, 0);

  const vars: Record<string, string> = {
    date: input.date,
    journal: input.journalText.trim() || "(no journal written)",
    language: input.language,
    totalPlanned: formatMinutes(totalPlanned),
    totalActual: formatMinutes(totalActual),
    tasksTable: renderTasksTable(summaries),
    history: input.history.trim() || "(no recent history available)",
    customStyle: input.customStyle.trim() || "(none)",
  };

  return {
    system: fillTemplate(templates.system, vars),
    prompt: fillTemplate(templates.user, vars),
  };
}
