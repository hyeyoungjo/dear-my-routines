import { describe, expect, it } from "vitest";
import type { ExportRow } from "@/core/export";
import {
  clampHistoryDays,
  summarizeReviewHistory,
  REVIEW_HISTORY_DAYS_DEFAULT,
  REVIEW_HISTORY_DAYS_MAX,
  REVIEW_HISTORY_DAYS_MIN,
} from "./reviewHistory";

/** Minimal ExportRow factory — only the fields the summarizer reads matter. */
function row(over: Partial<ExportRow>): ExportRow {
  return {
    date: "2026-06-20",
    task_name: "Task",
    project_name: "No project",
    task_category: null,
    completion_status: "completed_with_changes",
    planned_start_time: null,
    planned_end_time: null,
    planned_duration_min: null,
    actual_start_time: null,
    actual_end_time: null,
    actual_duration_min: null,
    duration_overrun_min: null,
    times_carried_over: 0,
    daily_journal: null,
    ...over,
  };
}

describe("clampHistoryDays", () => {
  it("falls back to the default for null/undefined/NaN", () => {
    expect(clampHistoryDays(null)).toBe(REVIEW_HISTORY_DAYS_DEFAULT);
    expect(clampHistoryDays(undefined)).toBe(REVIEW_HISTORY_DAYS_DEFAULT);
    expect(clampHistoryDays(Number.NaN)).toBe(REVIEW_HISTORY_DAYS_DEFAULT);
  });

  it("clamps to the [MIN, MAX] performance bounds and rounds", () => {
    expect(clampHistoryDays(0)).toBe(REVIEW_HISTORY_DAYS_MIN);
    expect(clampHistoryDays(999)).toBe(REVIEW_HISTORY_DAYS_MAX);
    expect(clampHistoryDays(7.6)).toBe(8);
  });
});

describe("summarizeReviewHistory", () => {
  it("reports a no-pattern line when nothing is notable", () => {
    const rows = [row({ planned_duration_min: 60, actual_duration_min: 60 })];
    expect(summarizeReviewHistory(rows, 14)).toBe(
      "(no notable estimation or deferral patterns in the last 14 days)",
    );
  });

  it("surfaces chronic under-estimation across multiple completed days", () => {
    const rows = [
      row({ date: "2026-06-20", task_name: "floor to 3D", project_name: "Directable", planned_duration_min: 165, actual_duration_min: 405 }),
      row({ date: "2026-06-22", task_name: "floor to 3D", project_name: "Directable", planned_duration_min: 180, actual_duration_min: 570 }),
    ];
    const out = summarizeReviewHistory(rows, 14);
    expect(out).toContain("Chronic under-estimation");
    expect(out).toContain('"floor to 3D" (Directable)');
    expect(out).toContain("2 days");
    expect(out).toContain("× over");
  });

  it("does not flag under-estimation from a single day", () => {
    const rows = [
      row({ task_name: "floor to 3D", planned_duration_min: 60, actual_duration_min: 600 }),
    ];
    expect(summarizeReviewHistory(rows, 14)).toContain("no notable");
  });

  it("surfaces repeatedly deferred tasks", () => {
    const rows = [
      row({ date: "2026-06-20", task_name: "formative study", project_name: "Talk2Sketch", completion_status: "deferred", times_carried_over: 5 }),
      row({ date: "2026-06-21", task_name: "formative study", project_name: "Talk2Sketch", completion_status: "deferred", times_carried_over: 5 }),
    ];
    const out = summarizeReviewHistory(rows, 14);
    expect(out).toContain("Repeatedly deferred");
    expect(out).toContain('"formative study" (Talk2Sketch)');
    expect(out).toContain("deferred 2d");
    expect(out).toContain("carried over 5×");
  });

  it("omits the project suffix when there is no project", () => {
    const rows = [
      row({ task_name: "Solo", planned_duration_min: 30, actual_duration_min: 90 }),
      row({ task_name: "Solo", planned_duration_min: 30, actual_duration_min: 120 }),
    ];
    const out = summarizeReviewHistory(rows, 14);
    expect(out).toContain('"Solo":');
    expect(out).not.toContain("(No project)");
  });
});
