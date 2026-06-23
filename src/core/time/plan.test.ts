import { describe, expect, it } from "vitest";
import { durationMinutes } from "./calendar";
import { dayKey, gridDayOf } from "./day";
import {
  type PlanBlock,
  carryCountOf,
  carryOverPlan,
  findOverduePlans,
  originalDateOf,
  planBelongsToDay,
  planSpan,
  plansForDay,
  revisedDateOf,
  shiftPlan,
} from "./plan";

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

describe("planBelongsToDay / plansForDay", () => {
  it("anchors a plan by its start's grid day", () => {
    const p = plan({ startAt: new Date(2026, 5, 22, 9, 0).toISOString() });
    expect(planBelongsToDay(p, new Date(2026, 5, 22))).toBe(true);
    expect(planBelongsToDay(p, new Date(2026, 5, 21))).toBe(false);
  });

  it("anchors a post-midnight plan to the previous grid day (ADR-013)", () => {
    // 01:00 Jun 23 is the tail of Jun 22's grid.
    const p = plan({ startAt: new Date(2026, 5, 23, 1, 0).toISOString() });
    expect(planBelongsToDay(p, new Date(2026, 5, 22))).toBe(true);
  });

  it("filters the plans that belong to a day", () => {
    const plans = [
      plan({ planBlockId: "a", startAt: new Date(2026, 5, 22, 9, 0).toISOString() }),
      plan({ planBlockId: "b", startAt: new Date(2026, 5, 21, 9, 0).toISOString() }),
    ];
    expect(plansForDay(plans, new Date(2026, 5, 22)).map((p) => p.planBlockId)).toEqual([
      "a",
    ]);
  });
});

describe("planSpan", () => {
  it("returns the span as Dates with the right duration", () => {
    const p = plan({
      startAt: new Date(2026, 5, 21, 14, 0).toISOString(),
      endAt: new Date(2026, 5, 21, 15, 30).toISOString(),
    });
    const span = planSpan(p);
    expect(durationMinutes(span.start, span.end)).toBe(90);
  });
});

describe("shiftPlan", () => {
  it("keeps the clock time and duration, moving date", () => {
    const p = plan({
      startAt: new Date(2026, 5, 21, 14, 0).toISOString(),
      endAt: new Date(2026, 5, 21, 15, 30).toISOString(),
    });
    const patch = shiftPlan(p, new Date(2026, 5, 22));

    const start = new Date(patch.startAt as string);
    const end = new Date(patch.endAt as string);
    expect(dayKey(start)).toBe("2026-06-22");
    expect([start.getHours(), start.getMinutes()]).toEqual([14, 0]);
    expect(durationMinutes(start, end)).toBe(90);
    expect(patch.date).toBe("2026-06-22");
    expect(patch.status).toBeUndefined(); // a reschedule is not a carry
  });

  it("anchors a post-midnight plan to the target's grid day", () => {
    const p = plan({
      startAt: new Date(2026, 5, 21, 1, 0).toISOString(),
      endAt: new Date(2026, 5, 21, 2, 0).toISOString(),
    });
    const patch = shiftPlan(p, new Date(2026, 5, 22));
    const start = new Date(patch.startAt as string);
    expect([start.getHours(), start.getMinutes()]).toEqual([1, 0]);
    expect(dayKey(start)).toBe("2026-06-23"); // next calendar date...
    expect(gridDayOf(start)).toBe("2026-06-22"); // ...but Jun 22's grid day.
  });
});

describe("carryOverPlan", () => {
  it("marks this plan missed AND births a new planned plan on toDate", () => {
    const p = plan({
      planBlockId: "src",
      taskId: "task-1",
      date: "2026-06-21",
      startAt: new Date(2026, 5, 21, 9, 0).toISOString(),
      endAt: new Date(2026, 5, 21, 10, 30).toISOString(),
    });
    const { missedPatch, nextPlan } = carryOverPlan(p, new Date(2026, 5, 22));

    expect(missedPatch).toEqual({ status: "missed" });

    expect(nextPlan.taskId).toBe("task-1");
    expect(nextPlan.date).toBe("2026-06-22");
    expect(nextPlan.status).toBe("planned");
    // The span keeps clock + duration, only the date moves.
    const start = new Date(nextPlan.startAt);
    const end = new Date(nextPlan.endAt);
    expect(dayKey(start)).toBe("2026-06-22");
    expect([start.getHours(), start.getMinutes()]).toEqual([9, 0]);
    expect(durationMinutes(start, end)).toBe(90);
    // `nextPlan` has no id — the caller's insert assigns it.
    expect("planBlockId" in nextPlan).toBe(false);
  });
});

describe("findOverduePlans", () => {
  // "Now" is during Jun 22's grid day.
  const today = new Date(2026, 5, 22, 9, 0);

  it("pulls forward a past-due planned plan", () => {
    const plans = [plan({ planBlockId: "old", date: "2026-06-20" })];
    expect(findOverduePlans(plans, today).map((p) => p.planBlockId)).toEqual(["old"]);
  });

  it("excludes a plan already on today's grid day (idempotency)", () => {
    const plans = [plan({ planBlockId: "today", date: "2026-06-22" })];
    expect(findOverduePlans(plans, today)).toEqual([]);
  });

  it("excludes a future plan", () => {
    const plans = [plan({ planBlockId: "fut", date: "2026-06-23" })];
    expect(findOverduePlans(plans, today)).toEqual([]);
  });

  it("excludes missed plans (only planned carries)", () => {
    const plans = [
      plan({ planBlockId: "missed", date: "2026-06-20", status: "missed" }),
      plan({ planBlockId: "planned", date: "2026-06-20", status: "planned" }),
    ];
    expect(findOverduePlans(plans, today).map((p) => p.planBlockId)).toEqual([
      "planned",
    ]);
  });
});

describe("per-task derived values", () => {
  it("originalDateOf is the earliest grid day; null when no plans", () => {
    const plans = [
      plan({ date: "2026-06-22" }),
      plan({ date: "2026-06-20" }),
      plan({ date: "2026-06-21" }),
    ];
    expect(originalDateOf(plans)).toBe("2026-06-20");
    expect(originalDateOf([])).toBeNull();
  });

  it("revisedDateOf is the latest still-planned grid day", () => {
    const plans = [
      plan({ date: "2026-06-20", status: "missed" }),
      plan({ date: "2026-06-21", status: "missed" }),
      plan({ date: "2026-06-22", status: "planned" }),
    ];
    expect(revisedDateOf(plans)).toBe("2026-06-22");
    // All carried away → no live plan.
    expect(revisedDateOf([plan({ status: "missed" })])).toBeNull();
  });

  it("carryCountOf counts missed plans", () => {
    const plans = [
      plan({ status: "missed" }),
      plan({ status: "missed" }),
      plan({ status: "planned" }),
    ];
    expect(carryCountOf(plans)).toBe(2);
    expect(carryCountOf([])).toBe(0);
  });
});
