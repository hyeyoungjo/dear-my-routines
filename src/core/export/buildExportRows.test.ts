import { describe, expect, it } from "vitest";
import { buildExportRows } from "./buildExportRows";
import type { ExportInput } from "./buildExportRows";

// --- minimal stub factories -------------------------------------------------

const NOW = new Date("2026-06-21T00:00:00Z"); // arbitrary, never used directly

function mkTask(overrides: Partial<ExportInput["tasks"][0]> = {}): ExportInput["tasks"][0] {
  return {
    taskId: "task-1",
    userId: "user-1",
    projectId: "proj-1",
    title: "Write tests",
    notes: null,
    category: null,
    createdOn: NOW,
    updatedOn: NOW,
    ...overrides,
  };
}

function mkProject(overrides: Partial<ExportInput["projects"][0]> = {}): ExportInput["projects"][0] {
  return {
    projectId: "proj-1",
    userId: "user-1",
    title: "My Project",
    projectColor: null,
    createdOn: NOW,
    updatedOn: NOW,
    ...overrides,
  };
}

function mkPlanBlock(overrides: Partial<ExportInput["planBlocks"][0]> = {}): ExportInput["planBlocks"][0] {
  return {
    planBlockId: "pb-1",
    userId: "user-1",
    taskId: "task-1",
    date: "2026-06-21",
    startAt: new Date("2026-06-21T09:00:00Z"),
    endAt: new Date("2026-06-21T10:00:00Z"),   // 60 min
    status: "planned",
    createdOn: NOW,
    updatedOn: NOW,
    ...overrides,
  };
}

function mkActionBlock(overrides: Partial<ExportInput["actionBlocks"][0]> = {}): ExportInput["actionBlocks"][0] {
  return {
    actionBlockId: "ab-1",
    userId: "user-1",
    taskId: "task-1",
    date: "2026-06-21",
    startAt: new Date("2026-06-21T09:00:00Z"),
    endAt: new Date("2026-06-21T10:00:00Z"),   // 60 min
    createdOn: NOW,
    updatedOn: NOW,
    ...overrides,
  };
}

function mkReview(overrides: Partial<ExportInput["dailyReviews"][0]> = {}): ExportInput["dailyReviews"][0] {
  return {
    id: "rev-1",
    userId: "user-1",
    date: "2026-06-21",
    journalText: "Today went well.",
    aiAnalysis: null,
    createdAt: NOW,
    ...overrides,
  };
}

// --- base input with one plan + one action (same time) ----------------------

function baseInput(overrides: Partial<ExportInput> = {}): ExportInput {
  return {
    tasks: [mkTask()],
    projects: [mkProject()],
    planBlocks: [mkPlanBlock()],
    actionBlocks: [mkActionBlock()],
    dailyReviews: [],
    allTaskPlanBlocks: [mkPlanBlock()],
    ...overrides,
  };
}

// --- tests ------------------------------------------------------------------

describe("buildExportRows — completion_status", () => {
  it("completed_as_planned: plan + action with 0-minute diff", () => {
    const [row] = buildExportRows(baseInput());
    expect(row.completion_status).toBe("completed_as_planned");
    expect(row.planned_duration_min).toBe(60);
    expect(row.actual_duration_min).toBe(60);
    expect(row.duration_overrun_min).toBe(0);
  });

  it("completed_with_changes: plan 60 min, action 120 min (diff >= 5)", () => {
    const input = baseInput({
      actionBlocks: [
        mkActionBlock({
          endAt: new Date("2026-06-21T11:00:00Z"), // 120 min
        }),
      ],
    });
    const [row] = buildExportRows(input);
    expect(row.completion_status).toBe("completed_with_changes");
    expect(row.planned_duration_min).toBe(60);
    expect(row.actual_duration_min).toBe(120);
    expect(row.duration_overrun_min).toBe(60);
  });

  it("deferred: plan exists but no action", () => {
    const input = baseInput({ actionBlocks: [] });
    const [row] = buildExportRows(input);
    expect(row.completion_status).toBe("deferred");
    expect(row.actual_duration_min).toBeNull();
    expect(row.duration_overrun_min).toBeNull();
  });

  it("added_on_the_day: action exists but no plan", () => {
    const input = baseInput({ planBlocks: [], allTaskPlanBlocks: [] });
    const [row] = buildExportRows(input);
    expect(row.completion_status).toBe("added_on_the_day");
    expect(row.planned_duration_min).toBeNull();
    expect(row.planned_start_time).toBeNull();
  });
});

describe("buildExportRows — times_carried_over", () => {
  it("counts missed plan_blocks across all time", () => {
    const input = baseInput({
      allTaskPlanBlocks: [
        mkPlanBlock({ planBlockId: "pb-miss-1", date: "2026-06-19", status: "missed" }),
        mkPlanBlock({ planBlockId: "pb-miss-2", date: "2026-06-20", status: "missed" }),
        mkPlanBlock({ planBlockId: "pb-planned", date: "2026-06-21", status: "planned" }),
      ],
    });
    const [row] = buildExportRows(input);
    expect(row.times_carried_over).toBe(2);
  });

  it("returns 0 when no missed plans", () => {
    const [row] = buildExportRows(baseInput());
    expect(row.times_carried_over).toBe(0);
  });
});

describe("buildExportRows — daily_journal", () => {
  it("fills journal_text when a review exists for that date", () => {
    const input = baseInput({ dailyReviews: [mkReview()] });
    const [row] = buildExportRows(input);
    expect(row.daily_journal).toBe("Today went well.");
  });

  it("returns null when no review for that date", () => {
    const [row] = buildExportRows(baseInput());
    expect(row.daily_journal).toBeNull();
  });
});

describe("buildExportRows — multiple tasks same day", () => {
  it("emits a separate row per task", () => {
    const task2 = mkTask({ taskId: "task-2", title: "Another task" });
    const input: ExportInput = {
      tasks: [mkTask(), task2],
      projects: [mkProject()],
      planBlocks: [
        mkPlanBlock({ planBlockId: "pb-1" }),
        mkPlanBlock({ planBlockId: "pb-2", taskId: "task-2" }),
      ],
      actionBlocks: [],
      dailyReviews: [],
      allTaskPlanBlocks: [
        mkPlanBlock({ planBlockId: "pb-1" }),
        mkPlanBlock({ planBlockId: "pb-2", taskId: "task-2" }),
      ],
    };
    const rows = buildExportRows(input);
    expect(rows).toHaveLength(2);
    // sorted by task_name ASC
    expect(rows[0].task_name).toBe("Another task");
    expect(rows[1].task_name).toBe("Write tests");
  });
});

describe("buildExportRows — time formatting", () => {
  it("formats HH:MM in local time", () => {
    // Use local Date constructor so the hours match toHHMM (which uses getHours)
    const input = baseInput({
      planBlocks: [
        mkPlanBlock({
          startAt: new Date(2026, 5, 21, 14, 30),  // 14:30 local
          endAt: new Date(2026, 5, 21, 16, 0),     // 16:00 local
        }),
      ],
      actionBlocks: [
        mkActionBlock({
          startAt: new Date(2026, 5, 21, 14, 30),
          endAt: new Date(2026, 5, 21, 17, 0),     // 17:00 local — 150 min actual
        }),
      ],
    });
    const [row] = buildExportRows(input);
    expect(row.planned_start_time).toBe("14:30");
    expect(row.planned_end_time).toBe("16:00");
    expect(row.planned_duration_min).toBe(90);
    expect(row.actual_start_time).toBe("14:30");
    expect(row.actual_end_time).toBe("17:00");
    expect(row.actual_duration_min).toBe(150);
  });
});

describe("buildExportRows — project_name", () => {
  it("shows No project when task has no projectId", () => {
    const input = baseInput({
      tasks: [mkTask({ projectId: null })],
    });
    const [row] = buildExportRows(input);
    expect(row.project_name).toBe("No project");
  });
});

describe("buildExportRows — sorting", () => {
  it("sorts by date ASC then task_name ASC", () => {
    const task2 = mkTask({ taskId: "task-2", title: "Alpha task" });
    const input: ExportInput = {
      tasks: [mkTask(), task2],
      projects: [mkProject()],
      planBlocks: [
        mkPlanBlock({ planBlockId: "pb-1", taskId: "task-1", date: "2026-06-22" }),
        mkPlanBlock({ planBlockId: "pb-2", taskId: "task-2", date: "2026-06-21" }),
      ],
      actionBlocks: [],
      dailyReviews: [],
      allTaskPlanBlocks: [],
    };
    const rows = buildExportRows(input);
    expect(rows[0].date).toBe("2026-06-21");
    expect(rows[1].date).toBe("2026-06-22");
  });
});
