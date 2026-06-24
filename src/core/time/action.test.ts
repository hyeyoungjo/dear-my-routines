import { describe, expect, it } from "vitest";
import {
  type ActionBlock,
  actionBelongsToDay,
  actionKindOf,
  actionSpan,
  actionsForDay,
  actualDateOf,
  actualMinutesOf,
  isOngoing,
  shiftAction,
} from "./action";
import { durationMinutes } from "./calendar";
import { dayKey } from "./day";
import type { PlanBlock } from "./plan";

/** An action with sensible defaults — override what a test needs. */
function action(partial: Partial<ActionBlock>): ActionBlock {
  return {
    actionBlockId: "a",
    taskId: "t",
    date: "2026-06-21",
    startAt: new Date(2026, 5, 21, 9, 0).toISOString(),
    endAt: new Date(2026, 5, 21, 10, 0).toISOString(),
    ...partial,
  };
}

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

describe("actionKindOf", () => {
  it("is 'added' when the task has no plan that day", () => {
    expect(actionKindOf(action({}), [])).toBe("added");
    // a plan on a different day doesn't count.
    expect(actionKindOf(action({ date: "2026-06-21" }), [plan({ date: "2026-06-20" })])).toBe(
      "added",
    );
  });

  it("is 'kept' when the action span equals the plan exactly", () => {
    expect(actionKindOf(action({}), [plan({})])).toBe("kept");
  });

  it("is 'revised' when a plan exists but the span differs", () => {
    const a = action({ endAt: new Date(2026, 5, 21, 11, 30).toISOString() });
    expect(actionKindOf(a, [plan({})])).toBe("revised");
  });

  it("is 'revised' for a still-running action (no end) with a plan", () => {
    expect(actionKindOf(action({ endAt: null }), [plan({})])).toBe("revised");
  });
});

describe("isOngoing", () => {
  it("is true when now falls within the span", () => {
    const a = action({
      startAt: new Date(2026, 5, 21, 9, 0).toISOString(),
      endAt: new Date(2026, 5, 21, 11, 0).toISOString(),
    });
    expect(isOngoing(a, new Date(2026, 5, 21, 10, 0))).toBe(true);
    expect(isOngoing(a, new Date(2026, 5, 21, 12, 0))).toBe(false);
    expect(isOngoing(a, new Date(2026, 5, 21, 8, 0))).toBe(false);
  });

  it("a running action (no end) is ongoing from its start onward", () => {
    const a = action({
      startAt: new Date(2026, 5, 21, 9, 0).toISOString(),
      endAt: null,
    });
    expect(isOngoing(a, new Date(2026, 5, 21, 23, 0))).toBe(true);
    expect(isOngoing(a, new Date(2026, 5, 21, 8, 0))).toBe(false);
  });
});

describe("actionBelongsToDay / actionsForDay", () => {
  it("includes an action whose startAt falls within the default window (7AM–midnight)", () => {
    const a = action({ startAt: new Date(2026, 5, 22, 9, 0).toISOString() });
    expect(actionBelongsToDay(a, new Date(2026, 5, 22))).toBe(true);
    expect(actionBelongsToDay(a, new Date(2026, 5, 21))).toBe(false);
  });

  it("excludes a 1 AM action from the default window", () => {
    const a = action({ startAt: new Date(2026, 5, 23, 1, 0).toISOString() });
    expect(actionBelongsToDay(a, new Date(2026, 5, 23))).toBe(false);
  });

  it("includes a 1 AM action in a cross-midnight window (e.g. 10 PM–3 AM)", () => {
    const a = action({ startAt: new Date(2026, 5, 23, 1, 0).toISOString() });
    expect(actionBelongsToDay(a, new Date(2026, 5, 22), 22, 27)).toBe(true);
  });

  it("filters the actions that fall within the day's window", () => {
    const actions = [
      action({ actionBlockId: "x", startAt: new Date(2026, 5, 22, 9, 0).toISOString() }),
      action({ actionBlockId: "y", startAt: new Date(2026, 5, 21, 9, 0).toISOString() }),
    ];
    expect(
      actionsForDay(actions, new Date(2026, 5, 22)).map((a) => a.actionBlockId),
    ).toEqual(["x"]);
  });
});

describe("actionSpan", () => {
  it("returns the span as Dates with the right duration", () => {
    const a = action({
      startAt: new Date(2026, 5, 21, 14, 0).toISOString(),
      endAt: new Date(2026, 5, 21, 15, 30).toISOString(),
    });
    const span = actionSpan(a)!;
    expect(durationMinutes(span.start, span.end)).toBe(90);
  });

  it("returns null while still running (no end yet)", () => {
    expect(actionSpan(action({ endAt: null }))).toBeNull();
  });
});

describe("shiftAction", () => {
  it("keeps clock + duration and moves its own date (unlike old actual)", () => {
    const a = action({
      date: "2026-06-21",
      startAt: new Date(2026, 5, 21, 14, 0).toISOString(),
      endAt: new Date(2026, 5, 21, 15, 30).toISOString(),
    });
    const patch = shiftAction(a, new Date(2026, 5, 22));

    const start = new Date(patch.startAt as string);
    const end = new Date(patch.endAt as string);
    expect(dayKey(start)).toBe("2026-06-22");
    expect([start.getHours(), start.getMinutes()]).toEqual([14, 0]);
    expect(durationMinutes(start, end)).toBe(90);
    expect(patch.date).toBe("2026-06-22"); // action owns its day now
  });

  it("moves a running action's start with no end", () => {
    const a = action({
      startAt: new Date(2026, 5, 21, 14, 0).toISOString(),
      endAt: null,
    });
    const patch = shiftAction(a, new Date(2026, 5, 22));
    expect(patch.date).toBe("2026-06-22");
    expect(patch.endAt).toBeUndefined();
  });

  it("places a 1 AM action on the target's calendar date", () => {
    const a = action({
      startAt: new Date(2026, 5, 21, 1, 0).toISOString(),
      endAt: new Date(2026, 5, 21, 2, 0).toISOString(),
    });
    const patch = shiftAction(a, new Date(2026, 5, 22));
    const start = new Date(patch.startAt as string);
    expect([start.getHours(), start.getMinutes()]).toEqual([1, 0]);
    // Calendar date = toDate (no post-midnight wrap).
    expect(dayKey(start)).toBe("2026-06-22");
  });
});

describe("per-task derived values", () => {
  it("actualDateOf is the latest action's grid day; null when none", () => {
    const actions = [
      action({ date: "2026-06-20" }),
      action({ date: "2026-06-23" }),
      action({ date: "2026-06-21" }),
    ];
    expect(actualDateOf(actions)).toBe("2026-06-23");
    expect(actualDateOf([])).toBeNull();
  });

  it("actualMinutesOf sums finished spans, ignoring still-running ones", () => {
    const actions = [
      action({
        startAt: new Date(2026, 5, 22, 9, 0).toISOString(),
        endAt: new Date(2026, 5, 22, 10, 30).toISOString(), // 90
      }),
      action({
        startAt: new Date(2026, 5, 23, 9, 0).toISOString(),
        endAt: new Date(2026, 5, 23, 9, 30).toISOString(), // 30
      }),
      action({ endAt: null }), // running → contributes 0
    ];
    expect(actualMinutesOf(actions)).toBe(120);
    expect(actualMinutesOf([])).toBe(0);
  });
});
