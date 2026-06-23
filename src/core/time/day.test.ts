import { describe, expect, it } from "vitest";
import {
  addDays,
  dayKey,
  gridDayOf,
  isSameMonth,
  monthGrid,
  startOfDay,
} from "./day";

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
