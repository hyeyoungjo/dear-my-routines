import { describe, expect, it } from "vitest";
import type { ActionBlock } from "./action";
import type { PlanBlock } from "./plan";
import { currentStatusOf } from "./status";

// "Now" is during Jun 22's grid day.
const today = new Date(2026, 5, 22, 9, 0);

function plan(partial: Partial<PlanBlock>): PlanBlock {
  return {
    planBlockId: "p",
    taskId: "t",
    date: "2026-06-22",
    startAt: new Date(2026, 5, 22, 9, 0).toISOString(),
    endAt: new Date(2026, 5, 22, 10, 0).toISOString(),
    status: "planned",
    ...partial,
  };
}

function action(partial: Partial<ActionBlock>): ActionBlock {
  return {
    actionBlockId: "a",
    taskId: "t",
    date: "2026-06-22",
    startAt: new Date(2026, 5, 22, 9, 0).toISOString(),
    endAt: new Date(2026, 5, 22, 10, 0).toISOString(),
    status: "done",
    ...partial,
  };
}

describe("currentStatusOf", () => {
  it("is 'in-progress' when any action is running, beating everything else", () => {
    const plans = [plan({ date: "2026-06-25" })]; // even a live future plan
    const actions = [action({ endAt: null, status: "in-progress" })];
    expect(currentStatusOf(plans, actions, today)).toBe("in-progress");
  });

  it("is 'planned' when a live plan sits on today or the future", () => {
    expect(currentStatusOf([plan({ date: "2026-06-22" })], [], today)).toBe(
      "planned",
    );
    expect(currentStatusOf([plan({ date: "2026-06-25" })], [], today)).toBe(
      "planned",
    );
  });

  it("is 'missed' when the live plan is overdue and nothing was done", () => {
    expect(currentStatusOf([plan({ date: "2026-06-20" })], [], today)).toBe(
      "missed",
    );
  });

  it("is 'missed' when plans exist but none are still planned (all carried)", () => {
    const plans = [
      plan({ date: "2026-06-20", status: "missed" }),
      plan({ date: "2026-06-21", status: "missed" }),
    ];
    expect(currentStatusOf(plans, [], today)).toBe("missed");
  });

  it("is 'done' when acted on and nothing live remains ahead", () => {
    const plans = [plan({ date: "2026-06-20", status: "missed" })];
    expect(currentStatusOf(plans, [action({})], today)).toBe("done");
  });

  it("is 'done' when acted on with no plans at all (unplanned work)", () => {
    expect(currentStatusOf([], [action({})], today)).toBe("done");
  });

  it("keeps 'planned' over a past action when a live future plan remains", () => {
    const plans = [
      plan({ date: "2026-06-20", status: "missed" }),
      plan({ date: "2026-06-25", status: "planned" }),
    ];
    expect(currentStatusOf(plans, [action({})], today)).toBe("planned");
  });

  it("is 'planned' for an unscheduled todo (no plans, no actions)", () => {
    expect(currentStatusOf([], [], today)).toBe("planned");
  });
});
