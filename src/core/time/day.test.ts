import { describe, expect, it } from "vitest";
import type { FlatNode } from "@/core/tree/types";
import {
  addDays,
  dayKey,
  gridDayOf,
  isSameMonth,
  monthGrid,
  nodeBelongsToDay,
  nodesForDay,
  startOfDay,
} from "./day";

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

describe("dayKey", () => {
  it("formats a local date as YYYY-MM-DD", () => {
    expect(dayKey(new Date(2026, 5, 21, 13, 30))).toBe("2026-06-21");
  });

  it("zero-pads month and day", () => {
    expect(dayKey(new Date(2026, 0, 4, 0, 0))).toBe("2026-01-04");
  });
});

describe("gridDayOf", () => {
  it("keeps a daytime timestamp on its own calendar day", () => {
    expect(gridDayOf(new Date(2026, 5, 21, 13, 0))).toBe("2026-06-21");
  });

  it("counts 07:00 (grid start) as that day", () => {
    expect(gridDayOf(new Date(2026, 5, 21, 7, 0))).toBe("2026-06-21");
  });

  it("rolls a post-midnight timestamp back to the previous day", () => {
    // 01:00 on Jun 22 is the tail of Jun 21's grid (07:00 → 02:00).
    expect(gridDayOf(new Date(2026, 5, 22, 1, 0))).toBe("2026-06-21");
  });

  it("counts 06:59 as the previous day, 07:00 as the new one", () => {
    expect(gridDayOf(new Date(2026, 5, 22, 6, 59))).toBe("2026-06-21");
    expect(gridDayOf(new Date(2026, 5, 22, 7, 0))).toBe("2026-06-22");
  });
});

describe("nodeBelongsToDay", () => {
  const day = new Date(2026, 5, 21, 0, 0);

  it("uses plannedStart's grid day when placed", () => {
    expect(
      nodeBelongsToDay(node({ plannedStart: new Date(2026, 5, 21, 9, 0) }), day),
    ).toBe(true);
    expect(
      nodeBelongsToDay(node({ plannedStart: new Date(2026, 5, 20, 9, 0) }), day),
    ).toBe(false);
  });

  it("anchors a post-midnight block to the previous day's grid", () => {
    expect(
      nodeBelongsToDay(node({ plannedStart: new Date(2026, 5, 22, 1, 0) }), day),
    ).toBe(true);
  });

  it("falls back to actualStart when there is no plannedStart", () => {
    expect(
      nodeBelongsToDay(node({ actualStart: new Date(2026, 5, 21, 15, 0) }), day),
    ).toBe(true);
  });

  it("falls back to plannedDate for an unplaced node", () => {
    expect(nodeBelongsToDay(node({ plannedDate: "2026-06-21" }), day)).toBe(true);
    expect(nodeBelongsToDay(node({ plannedDate: "2026-06-20" }), day)).toBe(false);
  });

  it("prefers a span over plannedDate when both exist", () => {
    expect(
      nodeBelongsToDay(
        node({
          plannedStart: new Date(2026, 5, 20, 9, 0),
          plannedDate: "2026-06-21",
        }),
        day,
      ),
    ).toBe(false);
  });

  it("belongs to no day when it has neither span nor plannedDate", () => {
    expect(nodeBelongsToDay(node({}), day)).toBe(false);
  });
});

describe("startOfDay", () => {
  it("zeros the time, keeping the calendar date", () => {
    const d = startOfDay(new Date(2026, 5, 21, 14, 37, 9));
    expect(dayKey(d)).toBe("2026-06-21");
    expect([d.getHours(), d.getMinutes(), d.getSeconds()]).toEqual([0, 0, 0]);
  });
});

describe("addDays", () => {
  it("shifts forward and backward, including across month ends", () => {
    expect(dayKey(addDays(new Date(2026, 5, 21), 1))).toBe("2026-06-22");
    expect(dayKey(addDays(new Date(2026, 5, 21), -1))).toBe("2026-06-20");
    expect(dayKey(addDays(new Date(2026, 5, 30), 1))).toBe("2026-07-01");
  });
});

describe("isSameMonth", () => {
  it("is true within a month, false across months or years", () => {
    expect(isSameMonth(new Date(2026, 5, 1), new Date(2026, 5, 30))).toBe(true);
    expect(isSameMonth(new Date(2026, 5, 30), new Date(2026, 6, 1))).toBe(false);
    expect(isSameMonth(new Date(2025, 5, 1), new Date(2026, 5, 1))).toBe(false);
  });
});

describe("monthGrid", () => {
  it("is a 6×7 grid of local-midnight days", () => {
    const weeks = monthGrid(new Date(2026, 5, 15));
    expect(weeks).toHaveLength(6);
    for (const week of weeks) expect(week).toHaveLength(7);
    const noon = weeks[0][0];
    expect([noon.getHours(), noon.getMinutes()]).toEqual([0, 0]);
  });

  it("starts each week on Sunday and includes the 1st", () => {
    const weeks = monthGrid(new Date(2026, 5, 15));
    expect(weeks[0][0].getDay()).toBe(0); // Sunday
    expect(weeks.flat().some((d) => dayKey(d) === "2026-06-01")).toBe(true);
  });

  it("is contiguous — every cell is the previous cell + 1 day", () => {
    const flat = monthGrid(new Date(2026, 1, 15)).flat(); // Feb 2026
    for (let i = 1; i < flat.length; i++) {
      expect(dayKey(flat[i])).toBe(dayKey(addDays(flat[i - 1], 1)));
    }
  });

  it("spills into neighbouring months for leading/trailing cells", () => {
    const weeks = monthGrid(new Date(2026, 5, 15)); // June 2026
    const target = new Date(2026, 5, 15);
    // Jun 1 is a Monday, so the first cell is the previous month.
    expect(isSameMonth(weeks[0][0], target)).toBe(false);
    expect(weeks[0][0].getMonth()).toBe(4); // May
  });
});

describe("nodesForDay", () => {
  it("keeps only the nodes belonging to the date", () => {
    const day = new Date(2026, 5, 21, 0, 0);
    const nodes = [
      node({ id: "a", plannedStart: new Date(2026, 5, 21, 9, 0) }),
      node({ id: "b", plannedStart: new Date(2026, 5, 22, 9, 0) }),
      node({ id: "c", plannedDate: "2026-06-21" }),
      node({ id: "d" }),
    ];
    expect(nodesForDay(nodes, day).map((n) => n.id)).toEqual(["a", "c"]);
  });
});
