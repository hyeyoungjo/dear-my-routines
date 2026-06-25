import { describe, expect, it } from "vitest";
import type { ActionBlock } from "./action";
import type { PlanBlock } from "./plan";
import {
  barEndDay,
  barStartDay,
  setDoneDay,
  setOriginalDay,
} from "./span";

/**
 * The bar (span) model — the behavior we agreed on with the user:
 *   start  6/20 ✕   6/21 ✕   6/22 ●(live plan)   end
 * Editing one end moves it and refills/trims the missed middle so the stored
 * rows always match the bar; carryCount (= missed count) stays exact.
 */

// A plan/action at 09:00–10:00 on `dateKey`, built from LOCAL time so the
// clock survives the round-trip through ISO strings regardless of timezone.
const at = (dateKey: string, h: number, m: number) => {
  const [y, mo, d] = dateKey.split("-").map(Number);
  return new Date(y, mo - 1, d, h, m).toISOString();
};
const plan = (
  dateKey: string,
  status: PlanBlock["status"],
): PlanBlock => ({
  planBlockId: dateKey,
  taskId: "t1",
  date: dateKey,
  startAt: at(dateKey, 9, 0),
  endAt: at(dateKey, 10, 0),
  status,
});

const BAR: PlanBlock[] = [
  plan("2026-06-20", "missed"),
  plan("2026-06-21", "missed"),
  plan("2026-06-22", "planned"),
];

describe("bar ends", () => {
  it("start = earliest plan, end = latest plan when not done", () => {
    expect(barStartDay(BAR)).toBe("2026-06-20");
    expect(barEndDay(BAR, null)).toBe("2026-06-22");
  });

  it("end = the action day once done", () => {
    const action: ActionBlock = {
      actionBlockId: "a1",
      taskId: "t1",
      date: "2026-06-23",
      startAt: at("2026-06-23", 9, 0),
      endAt: at("2026-06-23", 10, 0),
      status: "done",
    };
    expect(barEndDay(BAR, action)).toBe("2026-06-23");
  });

  it("null on an empty bar", () => {
    expect(barStartDay([])).toBeNull();
    expect(barEndDay([], null)).toBeNull();
  });
});

describe("setDoneDay — move the right end", () => {
  it("Done = 6/23: 6/22 becomes missed, 6/23 added as planned + action", () => {
    const { plan: pe, action } = setDoneDay(BAR, null, "t1", "2026-06-23");

    // 6/22 (was the live plan) is now a middle day → missed
    expect(pe.updates).toContainEqual({
      planBlockId: "2026-06-22",
      patch: { status: "missed" },
    });
    // 6/23 is the new end → a planned plan inserted there
    expect(pe.inserts).toHaveLength(1);
    expect(pe.inserts[0]).toMatchObject({
      date: "2026-06-23",
      status: "planned",
      taskId: "t1",
    });
    // nothing dropped; 6/20 & 6/21 already missed at the right clock → untouched
    expect(pe.deletes).toEqual([]);
    expect(pe.updates).toHaveLength(1);

    // an action is created on the done day
    expect(action).toEqual({
      kind: "insert",
      row: expect.objectContaining({ taskId: "t1", date: "2026-06-23" }),
    });

    // resulting missed count = 3 (6/20, 6/21, 6/22)
    const missedAfter =
      BAR.filter((p) => pe.updates.every((u) => u.planBlockId !== p.planBlockId))
        .filter((p) => p.status === "missed").length +
      pe.updates.filter((u) => u.patch.status === "missed").length +
      pe.inserts.filter((i) => i.status === "missed").length;
    expect(missedAfter).toBe(3);
  });

  it("Done = 6/21 with an existing action: trims the middle and moves the action", () => {
    const action: ActionBlock = {
      actionBlockId: "a1",
      taskId: "t1",
      date: "2026-06-24",
      startAt: at("2026-06-24", 9, 0),
      endAt: at("2026-06-24", 10, 0),
      status: "done",
    };
    const plansWithLater = [...BAR, plan("2026-06-23", "missed")];
    const { plan: pe, action: ae } = setDoneDay(
      plansWithLater,
      action,
      "t1",
      "2026-06-21",
    );

    // bar now ends at 6/21 → 6/22 & 6/23 dropped
    expect(pe.deletes.sort()).toEqual(["2026-06-22", "2026-06-23"]);
    // 6/21 becomes the end → planned
    expect(pe.updates).toContainEqual({
      planBlockId: "2026-06-21",
      patch: { status: "planned" },
    });
    // the action moves onto 6/21
    expect(ae).toMatchObject({
      kind: "update",
      actionBlockId: "a1",
      patch: { date: "2026-06-21" },
    });
  });
});

describe("setOriginalDay — move the left end", () => {
  it("Originally = 6/19: prepends one missed day (carry 2 → 3)", () => {
    const pe = setOriginalDay(BAR, "t1", "2026-06-19", null);
    expect(pe.inserts.map((i) => i.date)).toEqual(["2026-06-19"]);
    expect(pe.inserts[0].status).toBe("missed");
    expect(pe.deletes).toEqual([]);
    expect(pe.updates).toEqual([]);
  });

  it("Originally = 6/21: drops 6/20 (carry 2 → 1)", () => {
    const pe = setOriginalDay(BAR, "t1", "2026-06-21", null);
    expect(pe.deletes).toEqual(["2026-06-20"]);
    expect(pe.inserts).toEqual([]);
    // 6/21 stays missed (it's a middle day, not the end), 6/22 stays planned
    expect(pe.updates).toEqual([]);
  });

  it("clamps: a start past the end collapses to a one-day bar", () => {
    const pe = setOriginalDay(BAR, "t1", "2026-06-30", null);
    // start clamped to the end (6/22): 6/20 & 6/21 dropped, 6/22 stays
    expect(pe.deletes.sort()).toEqual(["2026-06-20", "2026-06-21"]);
  });
});
