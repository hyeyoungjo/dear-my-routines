import { describe, expect, it } from "vitest";
import { durationMinutes } from "./calendar";
import { dayKey } from "./day";
import {
  type PlanBlock,
  carryCountOf,
  carryOverPlan,
  continueLaterSpan,
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
  it("includes a plan whose startAt falls within the default window (7AM–midnight)", () => {
    const p = plan({ startAt: new Date(2026, 5, 22, 9, 0).toISOString() });
    expect(planBelongsToDay(p, new Date(2026, 5, 22))).toBe(true);
    expect(planBelongsToDay(p, new Date(2026, 5, 21))).toBe(false);
  });

  it("excludes a 1 AM plan from the default window (starts at 7 AM)", () => {
    // 01:00 Jun 23 is outside the 7AM–midnight window for Jun 23.
    const p = plan({ startAt: new Date(2026, 5, 23, 1, 0).toISOString() });
    expect(planBelongsToDay(p, new Date(2026, 5, 23))).toBe(false);
  });

  it("includes a 1 AM plan in a cross-midnight window (e.g. 10 PM–3 AM)", () => {
    // Jun 22's grid window [22, 27) includes 01:00 Jun 23.
    const p = plan({ startAt: new Date(2026, 5, 23, 1, 0).toISOString() });
    expect(planBelongsToDay(p, new Date(2026, 5, 22), 22, 27)).toBe(true);
    // But Jun 23's window [22, 27) starts at 10 PM Jun 23, not 1 AM.
    expect(planBelongsToDay(p, new Date(2026, 5, 23), 22, 27)).toBe(false);
  });

  it("filters the plans that fall within the day's window", () => {
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

  it("places a 1 AM plan on the target's calendar date (non-crossing grid)", () => {
    const p = plan({
      startAt: new Date(2026, 5, 21, 1, 0).toISOString(),
      endAt: new Date(2026, 5, 21, 2, 0).toISOString(),
    });
    const patch = shiftPlan(p, new Date(2026, 5, 22));
    const start = new Date(patch.startAt as string);
    expect([start.getHours(), start.getMinutes()]).toEqual([1, 0]);
    // Default 24h grid has no overhang → calendar date = toDate, no wrap.
    expect(dayKey(start)).toBe("2026-06-22");
  });

  it("wraps a 1 AM plan to the next calendar date on a cross-midnight grid", () => {
    // With a 07:00→02:00 grid (end = 26), 01:00 is the overhang: to land in
    // Jun 22's grid window [Jun 22 07:00, Jun 23 02:00) the timestamp must be
    // Jun 23 01:00 — otherwise Jun 22 01:00 falls back into Jun 21's window.
    const p = plan({
      startAt: new Date(2026, 5, 21, 1, 0).toISOString(),
      endAt: new Date(2026, 5, 21, 2, 0).toISOString(),
    });
    const patch = shiftPlan(p, new Date(2026, 5, 22), 26);
    const start = new Date(patch.startAt as string);
    expect([start.getHours(), start.getMinutes()]).toEqual([1, 0]);
    expect(dayKey(start)).toBe("2026-06-23"); // calendar date wrapped +1
    // The `date` key still names the grid day, not the calendar date.
    expect(patch.date).toBe("2026-06-22");
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

  it("carries a post-midnight plan onto the target grid day (cross-midnight grid)", () => {
    // The reported bug: "continue tomorrow" on a 1 AM block (visible on a
    // 07:00→02:00 grid) landed back on today. The carried plan must fall inside
    // the TARGET day's window and NOT the source day's.
    const gridStart = 7;
    const gridEnd = 26;
    const p = plan({
      date: "2026-06-21",
      startAt: new Date(2026, 5, 22, 1, 0).toISOString(), // shown on Jun 21's grid
      endAt: new Date(2026, 5, 22, 1, 30).toISOString(),
    });
    const { nextPlan } = carryOverPlan(p, new Date(2026, 5, 22), gridEnd);

    expect(nextPlan.date).toBe("2026-06-22"); // grid-day key
    const start = new Date(nextPlan.startAt);
    expect([start.getHours(), start.getMinutes()]).toEqual([1, 0]);
    expect(durationMinutes(new Date(nextPlan.startAt), new Date(nextPlan.endAt))).toBe(30);
    // Lands in Jun 22's window, not back in Jun 21's (the bug).
    expect(planBelongsToDay(nextPlan as PlanBlock, new Date(2026, 5, 22), gridStart, gridEnd)).toBe(true);
    expect(planBelongsToDay(nextPlan as PlanBlock, new Date(2026, 5, 21), gridStart, gridEnd)).toBe(false);
  });
});

describe("continueLaterSpan", () => {
  const day = new Date(2026, 5, 21);

  it("places the new block one gap after the source end (default 60m + 60m)", () => {
    const span = continueLaterSpan(new Date(2026, 5, 21, 14, 0), day);
    expect([span.start.getHours(), span.start.getMinutes()]).toEqual([15, 0]);
    expect([span.end.getHours(), span.end.getMinutes()]).toEqual([16, 0]);
  });

  it("snaps the start to the nearest 15-minute boundary", () => {
    // 14:07 + 60m = 15:07 → snaps down to 15:00.
    const span = continueLaterSpan(new Date(2026, 5, 21, 14, 7), day);
    expect([span.start.getHours(), span.start.getMinutes()]).toEqual([15, 0]);
    expect([span.end.getHours(), span.end.getMinutes()]).toEqual([16, 0]);
  });

  it("clamps against the grid window end, keeping the block length", () => {
    // 22:30 + 60m = 23:30, end 00:30 next day > 24:00 window end → slide back.
    const span = continueLaterSpan(new Date(2026, 5, 21, 22, 30), day);
    expect([span.start.getHours(), span.start.getMinutes()]).toEqual([23, 0]);
    expect(durationMinutes(span.start, span.end)).toBe(60);
    // end lands exactly on the window end (00:00 next calendar day).
    expect(dayKey(span.end)).toBe("2026-06-22");
    expect([span.end.getHours(), span.end.getMinutes()]).toEqual([0, 0]);
  });

  it("honors custom gap and duration", () => {
    // 14:00 + 30m gap = 14:30, + 90m duration = 16:00.
    const span = continueLaterSpan(new Date(2026, 5, 21, 14, 0), day, 24, 30, 90);
    expect([span.start.getHours(), span.start.getMinutes()]).toEqual([14, 30]);
    expect(durationMinutes(span.start, span.end)).toBe(90);
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

  it("excludes a plan whose task is already done (has an action)", () => {
    // The duplicate-task bug: a finished task's plan stays `planned`, so without
    // the doneTaskIds guard it would be carried forward every day.
    const plans = [
      plan({ planBlockId: "done", taskId: "t-done", date: "2026-06-20" }),
      plan({ planBlockId: "open", taskId: "t-open", date: "2026-06-20" }),
    ];
    const doneTaskIds = new Set(["t-done"]);
    expect(
      findOverduePlans(plans, today, doneTaskIds).map((p) => p.planBlockId),
    ).toEqual(["open"]);
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
