import { describe, expect, it } from "vitest";
import { durationMinutes } from "./calendar";
import { dayKey } from "./day";
import type { PlanBlock } from "./plan";
import { freshPlanToday, isShelved, shelvedTaskIds } from "./shelf";

/** A plan with sensible defaults — override what a test needs. */
function plan(partial: Partial<PlanBlock>): PlanBlock {
  return {
    planBlockId: "p",
    taskId: "t",
    date: "2026-06-21",
    startAt: new Date(2026, 5, 21, 9, 0).toISOString(),
    endAt: new Date(2026, 5, 21, 10, 0).toISOString(),
    status: "planned",
    ...partial,
  };
}

describe("isShelved", () => {
  it("is false when shelvedAt is null (active)", () => {
    expect(isShelved({ shelvedAt: null })).toBe(false);
  });

  it("is true for a Date shelvedAt", () => {
    expect(isShelved({ shelvedAt: new Date() })).toBe(true);
  });

  it("is true for an ISO-string shelvedAt (wire form)", () => {
    expect(isShelved({ shelvedAt: "2026-06-30T12:00:00.000Z" })).toBe(true);
  });
});

describe("shelvedTaskIds", () => {
  it("collects only shelved taskIds", () => {
    const tasks = [
      { taskId: "a", shelvedAt: null },
      { taskId: "b", shelvedAt: new Date() },
      { taskId: "c", shelvedAt: "2026-06-30T00:00:00.000Z" },
    ];
    expect(shelvedTaskIds(tasks)).toEqual(new Set(["b", "c"]));
  });

  it("is an empty set when all tasks are active", () => {
    const tasks = [
      { taskId: "a", shelvedAt: null },
      { taskId: "b", shelvedAt: null },
    ];
    expect(shelvedTaskIds(tasks).size).toBe(0);
  });
});

describe("freshPlanToday", () => {
  const today = new Date(2026, 6, 1); // 2026-07-01

  it("preserves the most recent plan's clock + duration, on today", () => {
    const plans = [
      plan({ date: "2026-06-20", startAt: new Date(2026, 5, 20, 8, 0).toISOString(), endAt: new Date(2026, 5, 20, 9, 30).toISOString() }),
      plan({ date: "2026-06-28", startAt: new Date(2026, 5, 28, 14, 0).toISOString(), endAt: new Date(2026, 5, 28, 15, 0).toISOString() }),
    ];
    const fresh = freshPlanToday("t", plans, today);

    expect(fresh.status).toBe("planned");
    expect(fresh.date).toBe(dayKey(today));
    // clock preserved from the latest plan (14:00), not the earlier one (08:00).
    const start = new Date(fresh.startAt);
    expect(start.getHours()).toBe(14);
    expect(start.getMinutes()).toBe(0);
    expect(durationMinutes(start, new Date(fresh.endAt))).toBe(60);
  });

  it("tie-breaks same-date plans by latest startAt", () => {
    const plans = [
      plan({ date: "2026-06-28", startAt: new Date(2026, 5, 28, 9, 0).toISOString(), endAt: new Date(2026, 5, 28, 10, 0).toISOString() }),
      plan({ date: "2026-06-28", startAt: new Date(2026, 5, 28, 20, 0).toISOString(), endAt: new Date(2026, 5, 28, 21, 0).toISOString() }),
    ];
    const fresh = freshPlanToday("t", plans, today);
    expect(new Date(fresh.startAt).getHours()).toBe(20);
  });

  it("falls back to a 1-hour default slot when the task has no plans", () => {
    const fresh = freshPlanToday("t", [], today);
    expect(fresh.status).toBe("planned");
    expect(fresh.date).toBe(dayKey(today));
    const start = new Date(fresh.startAt);
    expect(start.getHours()).toBe(7); // DEFAULT_GRID_START_HOUR
    expect(durationMinutes(start, new Date(fresh.endAt))).toBe(60);
  });

  it("does not mutate the input plans array", () => {
    const plans = [plan({ date: "2026-06-28" })];
    const snapshot = JSON.stringify(plans);
    freshPlanToday("t", plans, today);
    expect(JSON.stringify(plans)).toBe(snapshot);
  });
});
