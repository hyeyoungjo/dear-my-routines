import { describe, expect, it } from "vitest";
import {
  buildDailyReviewPrompt,
  formatMinutes,
  type DailyReviewPromptInput,
  type PromptTemplates,
} from "./dailyReviewPrompt";

const templates: PromptTemplates = {
  system: "SYSTEM — answer in {{language}}",
  user: "Date: {{date}}\nJournal: {{journal}}\nPlan: {{totalPlanned}} Actual: {{totalActual}}\n{{tasksTable}}",
};

// 09:00–09:30 = 30 min planned; 09:00–11:05 = 125 min actual.
const baseInput: DailyReviewPromptInput = {
  date: "2026-06-24",
  journalText: "Felt scattered today.",
  language: "한국어",
  history: "(no recent history available)",
  customStyle: "(none)",
  tasks: [
    {
      taskTitle: "Write report",
      projectTitle: "Work",
      category: "deep-work",
      plans: [{ startAt: "2026-06-24T09:00:00Z", endAt: "2026-06-24T09:30:00Z" }],
      actions: [{ startAt: "2026-06-24T09:00:00Z", endAt: "2026-06-24T11:05:00Z", status: "done" as const }],
    },
  ],
};

describe("formatMinutes", () => {
  it("formats sub-hour, exact-hour, and mixed durations", () => {
    expect(formatMinutes(0)).toBe("0m");
    expect(formatMinutes(45)).toBe("45m");
    expect(formatMinutes(120)).toBe("2h");
    expect(formatMinutes(125)).toBe("2h 5m");
  });
});

describe("buildDailyReviewPrompt", () => {
  it("interpolates the answer language into the system template", () => {
    const { system } = buildDailyReviewPrompt(baseInput, templates);
    expect(system).toBe("SYSTEM — answer in 한국어");
  });

  it("fills the journal, date, and per-task planned-vs-actual figures", () => {
    const { prompt } = buildDailyReviewPrompt(baseInput, templates);
    expect(prompt).toContain("Date: 2026-06-24");
    expect(prompt).toContain("Journal: Felt scattered today.");
    expect(prompt).toContain("Plan: 30m Actual: 2h 5m");
    expect(prompt).toContain(
      '- "Write report" (Work · deep-work): planned 30m → actual 2h 5m — done',
    );
  });

  it("marks a task with no actions as not done and contributing 0 actual", () => {
    const input: DailyReviewPromptInput = {
      ...baseInput,
      tasks: [{ ...baseInput.tasks[0], actions: [] }],
    };
    const { prompt } = buildDailyReviewPrompt(input, templates);
    expect(prompt).toContain("actual 0m — not done");
  });

  it("ignores a still-running action (null endAt) in the actual total", () => {
    const input: DailyReviewPromptInput = {
      ...baseInput,
      tasks: [
        {
          ...baseInput.tasks[0],
          actions: [{ startAt: "2026-06-24T09:00:00Z", endAt: null, status: "done" as const }],
        },
      ],
    };
    const { prompt } = buildDailyReviewPrompt(input, templates);
    // Running span counts as "done" (an action exists) but adds no minutes yet.
    expect(prompt).toContain("actual 0m — done");
  });

  it("substitutes a placeholder when the journal is empty", () => {
    const input: DailyReviewPromptInput = { ...baseInput, journalText: "  " };
    const { prompt } = buildDailyReviewPrompt(input, templates);
    expect(prompt).toContain("Journal: (no journal written)");
  });

  it("renders a fallback line when there are no tasks", () => {
    const input: DailyReviewPromptInput = { ...baseInput, tasks: [] };
    const { prompt } = buildDailyReviewPrompt(input, templates);
    expect(prompt).toContain("(no tasks were planned or logged for this day)");
  });
});
