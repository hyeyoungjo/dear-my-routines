import { describe, expect, it } from "vitest";
import type { FlatNode } from "@/core/tree/types";
import { durationMinutes } from "./calendar";
import { dayKey, gridDayOf, nodeBelongsToDay } from "./day";
import { carryOverNode, findOverdueUncarried, shiftPlannedToDate } from "./carry";

/** A minimal node with everything nullable cleared — override what a test needs. */
function node(partial: Partial<FlatNode>): FlatNode {
  return {
    id: "n",
    userId: "u",
    parentId: null,
    type: "task",
    title: "",
    notes: null,
    links: null,
    estimateMinutes: null,
    actualMinutes: null,
    plannedStart: null,
    plannedEnd: null,
    actualStart: null,
    actualEnd: null,
    status: "pending",
    category: null,
    color: null,
    isBig3: false,
    plannedDate: null,
    carryCount: 0,
    sortOrder: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...partial,
  } as FlatNode;
}

describe("shiftPlannedToDate", () => {
  it("keeps the clock time and duration, changing only the date", () => {
    const n = node({
      plannedStart: new Date(2026, 5, 21, 14, 0),
      plannedEnd: new Date(2026, 5, 21, 15, 30),
    });
    const patch = shiftPlannedToDate(n, new Date(2026, 5, 22));

    const start = patch.plannedStart as Date;
    const end = patch.plannedEnd as Date;
    expect(dayKey(start)).toBe("2026-06-22");
    expect([start.getHours(), start.getMinutes()]).toEqual([14, 0]);
    expect([end.getHours(), end.getMinutes()]).toEqual([15, 30]);
    expect(durationMinutes(start, end)).toBe(90);
    expect(patch.plannedDate).toBe("2026-06-22");
  });

  it("anchors a post-midnight block to the target's grid day (ADR-013)", () => {
    // 01:00 on Jun 21 is the tail of Jun 20's grid. Carried to grid day Jun 22,
    // the calendar date must become Jun 23 so it still draws at the bottom and
    // counts toward Jun 22.
    const n = node({
      plannedStart: new Date(2026, 5, 21, 1, 0),
      plannedEnd: new Date(2026, 5, 21, 2, 0),
    });
    const toDate = new Date(2026, 5, 22);
    const patch = shiftPlannedToDate(n, toDate);

    const start = patch.plannedStart as Date;
    expect([start.getHours(), start.getMinutes()]).toEqual([1, 0]);
    expect(dayKey(start)).toBe("2026-06-23"); // next calendar date...
    expect(gridDayOf(start)).toBe("2026-06-22"); // ...but Jun 22's grid day.
    // The moved node now genuinely belongs to the target day.
    expect(nodeBelongsToDay({ ...n, ...patch } as FlatNode, toDate)).toBe(true);
  });

  it("shifts plannedDate when the node has no placed span", () => {
    const n = node({ plannedDate: "2026-06-20" });
    const patch = shiftPlannedToDate(n, new Date(2026, 5, 22));
    expect(patch.plannedDate).toBe("2026-06-22");
    expect(patch.plannedStart).toBeUndefined();
  });
});

describe("carryOverNode", () => {
  it("increments carryCount and marks the node carried", () => {
    const n = node({
      plannedStart: new Date(2026, 5, 21, 9, 0),
      plannedEnd: new Date(2026, 5, 21, 10, 0),
      carryCount: 2,
    });
    const patch = carryOverNode(n, new Date(2026, 5, 22));
    expect(patch.carryCount).toBe(3);
    expect(patch.status).toBe("carried");
    // Still carries the span shift.
    expect(dayKey(patch.plannedStart as Date)).toBe("2026-06-22");
    expect((patch.plannedStart as Date).getHours()).toBe(9);
  });

  it("starts carryCount at 1 from the default 0", () => {
    const n = node({ plannedDate: "2026-06-20" });
    expect(carryOverNode(n, new Date(2026, 5, 22)).carryCount).toBe(1);
  });
});

describe("findOverdueUncarried", () => {
  // "Now" is during Jun 22's grid day.
  const today = new Date(2026, 5, 22, 9, 0);

  it("pulls forward a past-due, untouched pending task", () => {
    const nodes = [node({ id: "old", plannedStart: new Date(2026, 5, 20, 9, 0) })];
    expect(findOverdueUncarried(nodes, today).map((n) => n.id)).toEqual(["old"]);
  });

  it("excludes a node already on today's grid day (idempotency)", () => {
    const nodes = [
      node({ id: "today-span", plannedStart: new Date(2026, 5, 22, 9, 0) }),
      // Post-midnight tail of Jun 22's grid — still today, must not be re-pulled.
      node({ id: "today-tail", plannedStart: new Date(2026, 5, 23, 1, 0) }),
    ];
    expect(findOverdueUncarried(nodes, today)).toEqual([]);
  });

  it("excludes a future node", () => {
    const nodes = [node({ id: "fut", plannedStart: new Date(2026, 5, 23, 9, 0) })];
    expect(findOverdueUncarried(nodes, today)).toEqual([]);
  });

  it("excludes nodes already acted on (actualStart set)", () => {
    const nodes = [
      node({
        id: "acted",
        plannedStart: new Date(2026, 5, 20, 9, 0),
        actualStart: new Date(2026, 5, 20, 9, 5),
      }),
    ];
    expect(findOverdueUncarried(nodes, today)).toEqual([]);
  });

  it("excludes done, carried and dropped statuses", () => {
    const past = new Date(2026, 5, 20, 9, 0);
    const nodes = [
      node({ id: "done", plannedStart: past, status: "done" }),
      node({ id: "carried", plannedStart: past, status: "carried" }),
      node({ id: "dropped", plannedStart: past, status: "dropped" }),
    ];
    expect(findOverdueUncarried(nodes, today)).toEqual([]);
  });

  it("includes pending and in_progress past-due tasks", () => {
    const past = new Date(2026, 5, 20, 9, 0);
    const nodes = [
      node({ id: "pending", plannedStart: past, status: "pending" }),
      node({ id: "wip", plannedStart: past, status: "in_progress" }),
    ];
    expect(findOverdueUncarried(nodes, today).map((n) => n.id)).toEqual([
      "pending",
      "wip",
    ]);
  });

  it("excludes area and project containers", () => {
    const past = new Date(2026, 5, 20, 9, 0);
    const nodes = [
      node({ id: "area", type: "area", plannedStart: past }),
      node({ id: "project", type: "project", plannedStart: past }),
      node({ id: "subtask", type: "subtask", plannedStart: past }),
    ];
    expect(findOverdueUncarried(nodes, today).map((n) => n.id)).toEqual([
      "subtask",
    ]);
  });

  it("judges unplaced nodes by their plannedDate", () => {
    const nodes = [
      node({ id: "past", plannedDate: "2026-06-20" }),
      node({ id: "same", plannedDate: "2026-06-22" }),
      node({ id: "none" }), // belongs to no day → never overdue
    ];
    expect(findOverdueUncarried(nodes, today).map((n) => n.id)).toEqual(["past"]);
  });
});
