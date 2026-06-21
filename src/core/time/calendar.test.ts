import { describe, expect, it } from "vitest";
import {
  GRID_TOTAL_MINUTES,
  MIN_BLOCK_MINUTES,
  addMinutes,
  blockTopMinutes,
  durationMinutes,
  gridSlots,
  minutesFromGridStart,
  moveBlock,
  resizeBlockEnd,
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
