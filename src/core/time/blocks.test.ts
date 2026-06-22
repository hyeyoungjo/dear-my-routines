import { describe, expect, it } from "vitest";
import { durationMinutes } from "./calendar";
import { dayKey, gridDayOf } from "./day";
import {
  type FlatBlock,
  blockBelongsToDay,
  blockSpan,
  blocksForDay,
  carryCountOf,
  carryOverBlock,
  findOverdueBlocks,
  actualDateOf,
  plannedDateOf,
  revisedDateOf,
  shiftBlockActual,
  shiftBlockPlanned,
} from "./blocks";

/** A minimal block with everything nullable cleared — override what a test needs. */
function block(partial: Partial<FlatBlock>): FlatBlock {
  return {
    id: "b",
    nodeId: "n",
    gridDay: "2026-06-21",
    plannedStart: null,
    plannedEnd: null,
    actualStart: null,
    actualEnd: null,
    status: "planned",
    sortOrder: 0,
    ...partial,
  };
}

describe("blockBelongsToDay / blocksForDay", () => {
  it("anchors a placed block by its planned start's grid day", () => {
    const b = block({ plannedStart: new Date(2026, 5, 22, 9, 0).toISOString() });
    expect(blockBelongsToDay(b, new Date(2026, 5, 22))).toBe(true);
    expect(blockBelongsToDay(b, new Date(2026, 5, 21))).toBe(false);
  });

  it("anchors a post-midnight block to the previous grid day (ADR-013)", () => {
    // 01:00 Jun 23 is the tail of Jun 22's grid.
    const b = block({ plannedStart: new Date(2026, 5, 23, 1, 0).toISOString() });
    expect(blockBelongsToDay(b, new Date(2026, 5, 22))).toBe(true);
  });

  it("falls back to the stored gridDay when no span is placed", () => {
    const b = block({ gridDay: "2026-06-22" });
    expect(blockBelongsToDay(b, new Date(2026, 5, 22))).toBe(true);
    expect(blockBelongsToDay(b, new Date(2026, 5, 21))).toBe(false);
  });

  it("filters the blocks that belong to a day", () => {
    const blocks = [
      block({ id: "a", gridDay: "2026-06-22" }),
      block({ id: "b", gridDay: "2026-06-21" }),
    ];
    expect(blocksForDay(blocks, new Date(2026, 5, 22)).map((b) => b.id)).toEqual(["a"]);
  });
});

describe("blockSpan", () => {
  it("returns the plan / actual span as Dates", () => {
    const b = block({
      plannedStart: new Date(2026, 5, 21, 14, 0).toISOString(),
      plannedEnd: new Date(2026, 5, 21, 15, 30).toISOString(),
      actualStart: new Date(2026, 5, 21, 14, 10).toISOString(),
      actualEnd: new Date(2026, 5, 21, 16, 0).toISOString(),
    });
    const plan = blockSpan(b, "plan")!;
    expect(durationMinutes(plan.start, plan.end)).toBe(90);
    const actual = blockSpan(b, "actual")!;
    expect(durationMinutes(actual.start, actual.end)).toBe(110);
  });

  it("returns null when the pair is not fully set", () => {
    const b = block({ plannedStart: new Date(2026, 5, 21, 14, 0).toISOString() });
    expect(blockSpan(b, "plan")).toBeNull();
    expect(blockSpan(b, "actual")).toBeNull();
  });
});

describe("shiftBlockPlanned", () => {
  it("keeps the clock time and duration, moving date and gridDay", () => {
    const b = block({
      plannedStart: new Date(2026, 5, 21, 14, 0).toISOString(),
      plannedEnd: new Date(2026, 5, 21, 15, 30).toISOString(),
    });
    const patch = shiftBlockPlanned(b, new Date(2026, 5, 22));

    const start = new Date(patch.plannedStart as string);
    const end = new Date(patch.plannedEnd as string);
    expect(dayKey(start)).toBe("2026-06-22");
    expect([start.getHours(), start.getMinutes()]).toEqual([14, 0]);
    expect(durationMinutes(start, end)).toBe(90);
    expect(patch.gridDay).toBe("2026-06-22");
    expect(patch.status).toBeUndefined(); // a reschedule is not a carry
  });

  it("anchors a post-midnight block to the target's grid day", () => {
    const b = block({
      plannedStart: new Date(2026, 5, 21, 1, 0).toISOString(),
      plannedEnd: new Date(2026, 5, 21, 2, 0).toISOString(),
    });
    const patch = shiftBlockPlanned(b, new Date(2026, 5, 22));
    const start = new Date(patch.plannedStart as string);
    expect([start.getHours(), start.getMinutes()]).toEqual([1, 0]);
    expect(dayKey(start)).toBe("2026-06-23"); // next calendar date...
    expect(gridDayOf(start)).toBe("2026-06-22"); // ...but Jun 22's grid day.
  });

  it("yields an empty patch when there is no planned span", () => {
    expect(shiftBlockPlanned(block({}), new Date(2026, 5, 22))).toEqual({});
  });
});

describe("shiftBlockActual", () => {
  it("keeps the clock time and duration, never touching gridDay or status", () => {
    const b = block({
      gridDay: "2026-06-21",
      actualStart: new Date(2026, 5, 21, 14, 0).toISOString(),
      actualEnd: new Date(2026, 5, 21, 15, 30).toISOString(),
      status: "done",
    });
    const patch = shiftBlockActual(b, new Date(2026, 5, 22));

    const start = new Date(patch.actualStart as string);
    const end = new Date(patch.actualEnd as string);
    expect(dayKey(start)).toBe("2026-06-22");
    expect([start.getHours(), start.getMinutes()]).toEqual([14, 0]);
    expect(durationMinutes(start, end)).toBe(90);
    expect(patch.gridDay).toBeUndefined();
    expect(patch.status).toBeUndefined();
  });

  it("yields an empty patch when there is no actual span", () => {
    const b = block({ plannedStart: new Date(2026, 5, 21, 9, 0).toISOString() });
    expect(shiftBlockActual(b, new Date(2026, 5, 22))).toEqual({});
  });
});

describe("carryOverBlock", () => {
  it("marks this block missed AND births a new planned block on toDate", () => {
    const b = block({
      id: "src",
      nodeId: "task-1",
      gridDay: "2026-06-21",
      plannedStart: new Date(2026, 5, 21, 9, 0).toISOString(),
      plannedEnd: new Date(2026, 5, 21, 10, 30).toISOString(),
      sortOrder: 3,
    });
    const { missedPatch, nextBlock } = carryOverBlock(b, new Date(2026, 5, 22));

    expect(missedPatch).toEqual({ status: "missed" });

    expect(nextBlock.nodeId).toBe("task-1");
    expect(nextBlock.gridDay).toBe("2026-06-22");
    expect(nextBlock.status).toBe("planned");
    expect(nextBlock.sortOrder).toBe(3);
    expect(nextBlock.actualStart).toBeNull();
    expect(nextBlock.actualEnd).toBeNull();
    // The plan span keeps clock + duration, only the date moves.
    const start = new Date(nextBlock.plannedStart as string);
    const end = new Date(nextBlock.plannedEnd as string);
    expect(dayKey(start)).toBe("2026-06-22");
    expect([start.getHours(), start.getMinutes()]).toEqual([9, 0]);
    expect(durationMinutes(start, end)).toBe(90);
    // `nextBlock` has no id — the caller's insert assigns it.
    expect("id" in nextBlock).toBe(false);
  });
});

describe("findOverdueBlocks", () => {
  // "Now" is during Jun 22's grid day.
  const today = new Date(2026, 5, 22, 9, 0);

  it("pulls forward a past-due planned block", () => {
    const blocks = [block({ id: "old", gridDay: "2026-06-20" })];
    expect(findOverdueBlocks(blocks, today).map((b) => b.id)).toEqual(["old"]);
  });

  it("excludes a block already on today's grid day (idempotency)", () => {
    const blocks = [block({ id: "today", gridDay: "2026-06-22" })];
    expect(findOverdueBlocks(blocks, today)).toEqual([]);
  });

  it("excludes a future block", () => {
    const blocks = [block({ id: "fut", gridDay: "2026-06-23" })];
    expect(findOverdueBlocks(blocks, today)).toEqual([]);
  });

  it("excludes done and missed blocks (only planned carries)", () => {
    const blocks = [
      block({ id: "done", gridDay: "2026-06-20", status: "done" }),
      block({ id: "missed", gridDay: "2026-06-20", status: "missed" }),
      block({ id: "planned", gridDay: "2026-06-20", status: "planned" }),
    ];
    expect(findOverdueBlocks(blocks, today).map((b) => b.id)).toEqual(["planned"]);
  });
});

describe("per-task derived values", () => {
  it("plannedDateOf is the earliest grid day; null when no blocks", () => {
    const blocks = [
      block({ gridDay: "2026-06-22" }),
      block({ gridDay: "2026-06-20" }),
      block({ gridDay: "2026-06-21" }),
    ];
    expect(plannedDateOf(blocks)).toBe("2026-06-20");
    expect(plannedDateOf([])).toBeNull();
  });

  it("revisedDateOf is the latest still-planned grid day", () => {
    const blocks = [
      block({ gridDay: "2026-06-20", status: "missed" }),
      block({ gridDay: "2026-06-21", status: "missed" }),
      block({ gridDay: "2026-06-22", status: "planned" }),
    ];
    expect(revisedDateOf(blocks)).toBe("2026-06-22");
    // All carried away → no live plan.
    expect(revisedDateOf([block({ status: "missed" })])).toBeNull();
  });

  it("actualDateOf is the grid day of the (latest) acted-on block", () => {
    const blocks = [
      block({ gridDay: "2026-06-20", status: "missed" }),
      block({
        gridDay: "2026-06-22",
        status: "done",
        actualStart: new Date(2026, 5, 22, 9, 0).toISOString(),
      }),
    ];
    expect(actualDateOf(blocks)).toBe("2026-06-22");
    expect(actualDateOf([block({})])).toBeNull();
  });

  it("carryCountOf counts missed blocks", () => {
    const blocks = [
      block({ status: "missed" }),
      block({ status: "missed" }),
      block({ status: "planned" }),
      block({ status: "done" }),
    ];
    expect(carryCountOf(blocks)).toBe(2);
    expect(carryCountOf([])).toBe(0);
  });
});
