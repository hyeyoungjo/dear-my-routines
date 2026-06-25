import { describe, expect, it } from "vitest";
import {
  GRID_TOTAL_MINUTES,
  MIN_BLOCK_MINUTES,
  addMinutes,
  blockPixelHeight,
  blockTopMinutes,
  childOffsetPx,
  clampChildToParent,
  durationMinutes,
  fitParentToChildren,
  formatHours,
  gridSlots,
  minutesFromGridStart,
  moveBlock,
  resizeBlockEnd,
  resizeBlockStart,
  slotDate,
  snapMinutes,
  snapToSlot,
} from "./calendar";

describe("gridSlots", () => {
  it("spans 07:00 → 02:00 inclusive (20 hourly labels)", () => {
    const slots = gridSlots();
    expect(slots).toHaveLength(20);
    expect(slots[0]).toEqual({ offsetMinutes: 0, label: "07:00" });
    expect(slots.at(-1)).toEqual({
      offsetMinutes: GRID_TOTAL_MINUTES,
      label: "02:00",
    });
  });

  it("labels midnight as 00:00, not 24:00", () => {
    const midnight = gridSlots().find((s) => s.offsetMinutes === 17 * 60);
    expect(midnight?.label).toBe("00:00");
  });
});

describe("minutesFromGridStart", () => {
  it("measures from 07:00", () => {
    expect(minutesFromGridStart(7, 0)).toBe(0);
    expect(minutesFromGridStart(9, 30)).toBe(150);
  });

  it("wraps post-midnight hours to the tail of the grid", () => {
    expect(minutesFromGridStart(0, 0)).toBe(17 * 60);
    expect(minutesFromGridStart(2, 0)).toBe(GRID_TOTAL_MINUTES);
  });
});

describe("blockTopMinutes / durationMinutes", () => {
  it("reads the start's wall-clock position", () => {
    expect(blockTopMinutes(new Date(2026, 5, 21, 8, 15))).toBe(75);
  });

  it("measures a span in whole minutes", () => {
    const start = new Date(2026, 5, 21, 9, 0);
    const end = new Date(2026, 5, 21, 10, 30);
    expect(durationMinutes(start, end)).toBe(90);
  });
});

describe("slotDate", () => {
  it("anchors 07:00 on the base day and adds the offset", () => {
    const base = new Date(2026, 5, 21, 13, 47); // time-of-day is ignored
    expect(slotDate(base, 0).getHours()).toBe(7);
    expect(slotDate(base, 120).getHours()).toBe(9);
  });

  it("rolls past midnight into the next day", () => {
    const base = new Date(2026, 5, 21, 0, 0);
    const past = slotDate(base, 18 * 60); // 07:00 + 18h = 01:00 next day
    expect(past.getDate()).toBe(22);
    expect(past.getHours()).toBe(1);
  });
});

describe("snapToSlot", () => {
  it("floors to the hour and clamps inside the grid", () => {
    expect(snapToSlot(75)).toBe(60);
    expect(snapToSlot(-30)).toBe(0);
    expect(snapToSlot(GRID_TOTAL_MINUTES)).toBe(GRID_TOTAL_MINUTES - 60);
  });
});

describe("snapMinutes", () => {
  it("rounds a raw delta to the nearest 15-minute step", () => {
    expect(snapMinutes(7)).toBe(0);
    expect(snapMinutes(8)).toBe(15);
    expect(snapMinutes(-22)).toBe(-15);
    expect(snapMinutes(38)).toBe(45);
  });
});

describe("addMinutes", () => {
  it("returns a new shifted Date without mutating the input", () => {
    const base = new Date(2026, 5, 21, 9, 0);
    const later = addMinutes(base, 90);
    expect(later.getHours()).toBe(10);
    expect(later.getMinutes()).toBe(30);
    expect(base.getHours()).toBe(9); // unchanged
  });
});

describe("moveBlock", () => {
  it("shifts both edges, preserving duration", () => {
    const start = new Date(2026, 5, 21, 9, 0);
    const end = new Date(2026, 5, 21, 10, 0);
    const moved = moveBlock(start, end, 30);
    expect(moved.start.getHours()).toBe(9);
    expect(moved.start.getMinutes()).toBe(30);
    expect(durationMinutes(moved.start, moved.end)).toBe(60);
  });

  it("moves upward (negative delta) too", () => {
    const start = new Date(2026, 5, 21, 9, 0);
    const end = new Date(2026, 5, 21, 10, 0);
    const moved = moveBlock(start, end, -45);
    expect(moved.start.getHours()).toBe(8);
    expect(moved.start.getMinutes()).toBe(15);
  });
});

describe("resizeBlockEnd", () => {
  it("grows the end by the delta, keeping the start fixed", () => {
    const start = new Date(2026, 5, 21, 9, 0);
    const end = new Date(2026, 5, 21, 10, 0);
    const resized = resizeBlockEnd(start, end, 30);
    expect(resized.start).toBe(start);
    expect(durationMinutes(start, resized.end)).toBe(90);
  });

  it("never shrinks below the minimum length (no inversion)", () => {
    const start = new Date(2026, 5, 21, 9, 0);
    const end = new Date(2026, 5, 21, 10, 0);
    const resized = resizeBlockEnd(start, end, -120); // would invert
    expect(durationMinutes(start, resized.end)).toBe(MIN_BLOCK_MINUTES);
  });
});

describe("resizeBlockStart", () => {
  it("moves the start earlier by the delta, keeping the end fixed", () => {
    const start = new Date(2026, 5, 21, 9, 0);
    const end = new Date(2026, 5, 21, 10, 0);
    const resized = resizeBlockStart(start, end, -30); // drag up 30 min
    expect(resized.end).toBe(end);
    expect(durationMinutes(resized.start, end)).toBe(90);
  });

  it("moves the start later by the delta, keeping the end fixed", () => {
    const start = new Date(2026, 5, 21, 9, 0);
    const end = new Date(2026, 5, 21, 10, 0);
    const resized = resizeBlockStart(start, end, 30); // drag down 30 min
    expect(resized.end).toBe(end);
    expect(durationMinutes(resized.start, end)).toBe(30);
  });

  it("never shrinks below the minimum length (no inversion)", () => {
    const start = new Date(2026, 5, 21, 9, 0);
    const end = new Date(2026, 5, 21, 10, 0);
    const resized = resizeBlockStart(start, end, 120); // would invert
    expect(durationMinutes(resized.start, end)).toBe(MIN_BLOCK_MINUTES);
  });
});

describe("clampChildToParent", () => {
  const parent = {
    start: new Date(2026, 5, 21, 9, 0),
    end: new Date(2026, 5, 21, 11, 0),
  };

  it("leaves a child already inside the parent untouched", () => {
    const child = {
      start: new Date(2026, 5, 21, 9, 30),
      end: new Date(2026, 5, 21, 10, 0),
    };
    const clamped = clampChildToParent(child, parent);
    expect(clamped.start.getHours()).toBe(9);
    expect(clamped.start.getMinutes()).toBe(30);
    expect(durationMinutes(clamped.start, clamped.end)).toBe(30);
  });

  it("pushes a child starting before the parent up to the parent start", () => {
    const child = {
      start: new Date(2026, 5, 21, 8, 0),
      end: new Date(2026, 5, 21, 10, 0),
    };
    const clamped = clampChildToParent(child, parent);
    expect(clamped.start.getTime()).toBe(parent.start.getTime());
    expect(clamped.end.getHours()).toBe(10);
  });

  it("clips a child overflowing the parent end down to the parent end", () => {
    const child = {
      start: new Date(2026, 5, 21, 10, 0),
      end: new Date(2026, 5, 21, 12, 0),
    };
    const clamped = clampChildToParent(child, parent);
    expect(clamped.end.getTime()).toBe(parent.end.getTime());
  });

  it("clips a child longer than the parent to exactly the parent span", () => {
    const child = {
      start: new Date(2026, 5, 21, 7, 0),
      end: new Date(2026, 5, 21, 13, 0),
    };
    const clamped = clampChildToParent(child, parent);
    expect(clamped.start.getTime()).toBe(parent.start.getTime());
    expect(clamped.end.getTime()).toBe(parent.end.getTime());
  });
});

describe("fitParentToChildren", () => {
  const parent = {
    start: new Date(2026, 5, 21, 9, 0),
    end: new Date(2026, 5, 21, 11, 0),
  };

  it("returns the parent unchanged when there are no children", () => {
    const fitted = fitParentToChildren(parent, []);
    expect(fitted.start.getTime()).toBe(parent.start.getTime());
    expect(fitted.end.getTime()).toBe(parent.end.getTime());
  });

  it("returns the parent unchanged when children fit exactly", () => {
    const children = [
      { start: new Date(2026, 5, 21, 9, 0), end: new Date(2026, 5, 21, 11, 0) },
    ];
    const fitted = fitParentToChildren(parent, children);
    expect(fitted.start.getTime()).toBe(parent.start.getTime());
    expect(fitted.end.getTime()).toBe(parent.end.getTime());
  });

  it("stretches the end when a child overflows past it (subproject growth)", () => {
    const children = [
      { start: new Date(2026, 5, 21, 10, 0), end: new Date(2026, 5, 21, 12, 30) },
    ];
    const fitted = fitParentToChildren(parent, children);
    expect(fitted.start.getTime()).toBe(parent.start.getTime());
    expect(fitted.end.getHours()).toBe(12);
    expect(fitted.end.getMinutes()).toBe(30);
  });

  it("stretches both edges to wrap every child", () => {
    const children = [
      { start: new Date(2026, 5, 21, 8, 0), end: new Date(2026, 5, 21, 9, 30) },
      { start: new Date(2026, 5, 21, 10, 30), end: new Date(2026, 5, 21, 12, 0) },
    ];
    const fitted = fitParentToChildren(parent, children);
    expect(fitted.start.getHours()).toBe(8);
    expect(fitted.end.getHours()).toBe(12);
  });

  it("does not mutate the parent or child inputs", () => {
    const children = [
      { start: new Date(2026, 5, 21, 8, 0), end: new Date(2026, 5, 21, 12, 0) },
    ];
    fitParentToChildren(parent, children);
    expect(parent.start.getHours()).toBe(9);
    expect(parent.end.getHours()).toBe(11);
  });
});

describe("childOffsetPx", () => {
  const PPM = 1; // 1px per minute keeps the arithmetic obvious.

  it("is zero when the child starts at the parent's start (no header inset)", () => {
    const at = new Date(2026, 5, 21, 9, 0);
    expect(childOffsetPx(at, at, PPM)).toBe(0);
  });

  it("drops a later-starting child by its pure time offset", () => {
    const parentStart = new Date(2026, 5, 21, 9, 0);
    const childStart = new Date(2026, 5, 21, 9, 30); // 30m later
    expect(childOffsetPx(parentStart, childStart, PPM)).toBe(30);
  });

  it("scales the offset by pxPerMinute", () => {
    const parentStart = new Date(2026, 5, 21, 9, 0);
    const childStart = new Date(2026, 5, 21, 9, 30);
    expect(childOffsetPx(parentStart, childStart, 2)).toBe(60);
  });
});

describe("blockPixelHeight", () => {
  const PPM = 1; // 1px per minute.

  it("is exactly the block's own time span (the title eats no time)", () => {
    const block = {
      span: {
        start: new Date(2026, 5, 21, 9, 0),
        end: new Date(2026, 5, 21, 10, 0), // 60m
      },
    };
    expect(blockPixelHeight(block, PPM)).toBe(60);
  });

  it("scales the height by pxPerMinute", () => {
    const block = {
      span: {
        start: new Date(2026, 5, 21, 9, 0),
        end: new Date(2026, 5, 21, 9, 30), // 30m
      },
    };
    expect(blockPixelHeight(block, 2)).toBe(60);
  });

  it("covers an overflowing child once the span is grown to wrap it", () => {
    // The grid grows a parent's span with fitParentToChildren, so by the time
    // it reaches blockPixelHeight the span already contains every child — height
    // is just that grown span in pixels, no recursion or header stacking.
    const start = new Date(2026, 5, 21, 9, 0);
    const grown = fitParentToChildren(
      { start, end: new Date(2026, 5, 21, 9, 30) }, // 30m own
      [{ start, end: new Date(2026, 5, 21, 10, 30) }], // child overflows to +90m
    );
    expect(blockPixelHeight({ span: grown }, PPM)).toBe(90);
  });
});

describe("formatHours", () => {
  it("reads under an hour as minutes", () => {
    expect(formatHours(45)).toBe("45m");
    expect(formatHours(0)).toBe("0m");
  });

  it("reads a whole hour without a decimal", () => {
    expect(formatHours(60)).toBe("1h");
    expect(formatHours(120)).toBe("2h");
  });

  it("reads a partial hour with one decimal", () => {
    expect(formatHours(90)).toBe("1.5h");
    expect(formatHours(125)).toBe("2.1h");
  });
});
