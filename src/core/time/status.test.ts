import { describe, expect, it } from "vitest";
import type { ActionBlock } from "./action";
import type { PlanBlock } from "./plan";
import { currentStatusOf, projectStatusOf } from "./status";

// "Now" is during Jun 22's grid day, at 09:00.
const now = new Date(2026, 5, 22, 9, 0);

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
    date: "2026-06-20",
    startAt: new Date(2026, 5, 20, 9, 0).toISOString(),
    endAt: new Date(2026, 5, 20, 10, 0).toISOString(),
    ...partial,
  };
}

describe("currentStatusOf", () => {
  it("is 'doing' when an action spans now, beating everything else", () => {
    const plans = [plan({ date: "2026-06-25" })]; // even a live future plan
    const actions = [
      action({
        startAt: new Date(2026, 5, 22, 8, 30).toISOString(),
        endAt: new Date(2026, 5, 22, 9, 30).toISOString(), // contains 09:00
      }),
    ];
    expect(currentStatusOf(plans, actions, now)).toBe("doing");
  });

  it("is 'todo' when a live plan sits on today or the future", () => {
    expect(currentStatusOf([plan({ date: "2026-06-22" })], [], now)).toBe("todo");
    expect(currentStatusOf([plan({ date: "2026-06-25" })], [], now)).toBe("todo");
  });

  it("is 'overdue' when the live plan is past and nothing was done", () => {
    expect(currentStatusOf([plan({ date: "2026-06-20" })], [], now)).toBe(
      "overdue",
    );
  });

  it("is 'overdue' when plans exist but none are still planned (all carried)", () => {
    const plans = [
      plan({ date: "2026-06-20", status: "missed" }),
      plan({ date: "2026-06-21", status: "missed" }),
    ];
    expect(currentStatusOf(plans, [], now)).toBe("overdue");
  });

  it("is 'done' when acted on and nothing live remains ahead", () => {
    const plans = [plan({ date: "2026-06-20", status: "missed" })];
    expect(currentStatusOf(plans, [action({})], now)).toBe("done");
  });

  it("keeps 'todo' over a past action when a live future plan remains", () => {
    const plans = [
      plan({ date: "2026-06-20", status: "missed" }),
      plan({ date: "2026-06-25", status: "planned" }),
    ];
    expect(currentStatusOf(plans, [action({})], now)).toBe("todo");
  });

  it("is 'todo' for an unscheduled task (no plans, no actions)", () => {
    expect(currentStatusOf([], [], now)).toBe("todo");
  });
});

describe("projectStatusOf", () => {
  it("is 'todo' for an empty project", () => {
    expect(projectStatusOf([])).toBe("todo");
  });

  it("surfaces 'doing' above everything", () => {
    expect(projectStatusOf(["done", "overdue", "doing", "todo"])).toBe("doing");
  });

  it("surfaces 'overdue' when something is behind (and none doing)", () => {
    expect(projectStatusOf(["done", "todo", "overdue"])).toBe("overdue");
  });

  it("is 'done' only when every task is done", () => {
    expect(projectStatusOf(["done", "done"])).toBe("done");
    expect(projectStatusOf(["done", "todo"])).toBe("todo");
  });
});
