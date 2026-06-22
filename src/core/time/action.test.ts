import { describe, expect, it } from "vitest";
import {
  type ActionBlock,
  actionBelongsToDay,
  actionSpan,
  actionsForDay,
  actualDateOf,
  actualMinutesOf,
  shiftAction,
} from "./action";
import { durationMinutes } from "./calendar";
import { dayKey, gridDayOf } from "./day";

/** An action with sensible defaults — override what a test needs. */
function action(partial: Partial<ActionBlock>): ActionBlock {
  return {
    id: "a",
    nodeId: "n",
    gridDay: "2026-06-21",
    startAt: new Date(2026, 5, 21, 9, 0).toISOString(),
    endAt: new Date(2026, 5, 21, 10, 0).toISOString(),
    ...partial,
  };
}

describe("actionBelongsToDay / actionsForDay", () => {
  it("anchors an action by its start's grid day", () => {
    const a = action({ startAt: new Date(2026, 5, 22, 9, 0).toISOString() });
    expect(actionBelongsToDay(a, new Date(2026, 5, 22))).toBe(true);
    expect(actionBelongsToDay(a, new Date(2026, 5, 21))).toBe(false);
  });

  it("anchors a post-midnight action to the previous grid day (ADR-013)", () => {
    const a = action({ startAt: new Date(2026, 5, 23, 1, 0).toISOString() });
    expect(actionBelongsToDay(a, new Date(2026, 5, 22))).toBe(true);
  });

  it("filters the actions that belong to a day", () => {
    const actions = [
      action({ id: "x", startAt: new Date(2026, 5, 22, 9, 0).toISOString() }),
      action({ id: "y", startAt: new Date(2026, 5, 21, 9, 0).toISOString() }),
    ];
    expect(actionsForDay(actions, new Date(2026, 5, 22)).map((a) => a.id)).toEqual(["x"]);
  });
});

describe("actionSpan", () => {
  it("returns the span as Dates with the right duration", () => {
    const a = action({
      startAt: new Date(2026, 5, 21, 14, 0).toISOString(),
      endAt: new Date(2026, 5, 21, 15, 30).toISOString(),
    });
    const span = actionSpan(a);
    expect(durationMinutes(span.start, span.end)).toBe(90);
  });
});

describe("shiftAction", () => {
  it("keeps clock + duration and moves its own gridDay (unlike old actual)", () => {
    const a = action({
      gridDay: "2026-06-21",
      startAt: new Date(2026, 5, 21, 14, 0).toISOString(),
      endAt: new Date(2026, 5, 21, 15, 30).toISOString(),
    });
    const patch = shiftAction(a, new Date(2026, 5, 22));

    const start = new Date(patch.startAt as string);
    const end = new Date(patch.endAt as string);
    expect(dayKey(start)).toBe("2026-06-22");
    expect([start.getHours(), start.getMinutes()]).toEqual([14, 0]);
    expect(durationMinutes(start, end)).toBe(90);
    expect(patch.gridDay).toBe("2026-06-22"); // action owns its day now
  });

  it("anchors a post-midnight action to the target's grid day", () => {
    const a = action({
      startAt: new Date(2026, 5, 21, 1, 0).toISOString(),
      endAt: new Date(2026, 5, 21, 2, 0).toISOString(),
    });
    const patch = shiftAction(a, new Date(2026, 5, 22));
    const start = new Date(patch.startAt as string);
    expect([start.getHours(), start.getMinutes()]).toEqual([1, 0]);
    expect(dayKey(start)).toBe("2026-06-23"); // next calendar date...
    expect(gridDayOf(start)).toBe("2026-06-22"); // ...but Jun 22's grid day.
  });
});

describe("per-task derived values", () => {
  it("actualDateOf is the latest action's grid day; null when none", () => {
    const actions = [
      action({ gridDay: "2026-06-20" }),
      action({ gridDay: "2026-06-23" }),
      action({ gridDay: "2026-06-21" }),
    ];
    expect(actualDateOf(actions)).toBe("2026-06-23");
    expect(actualDateOf([])).toBeNull();
  });

  it("actualMinutesOf sums every action span (multi-day execution)", () => {
    const actions = [
      action({
        startAt: new Date(2026, 5, 22, 9, 0).toISOString(),
        endAt: new Date(2026, 5, 22, 10, 30).toISOString(), // 90
      }),
      action({
        startAt: new Date(2026, 5, 23, 9, 0).toISOString(),
        endAt: new Date(2026, 5, 23, 9, 30).toISOString(), // 30
      }),
    ];
    expect(actualMinutesOf(actions)).toBe(120);
    expect(actualMinutesOf([])).toBe(0);
  });
});
