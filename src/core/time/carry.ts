import { startOfDay } from "./day";

/**
 * Pure span-shift math for carry-over and reschedule (ADR-013/014). No React, no
 * DB, no network (CLAUDE.md CRITICAL). Blocks are attributed to their calendar
 * date (midnight boundary); display filtering handles cross-midnight grids in
 * plansForDay / actionsForDay.
 *
 * Per-day placement now lives on `task_blocks`, so the node-level carry helpers
 * are gone (ADR-014); `blocks.ts` reuses `shiftSpanOntoGridDay` below for the
 * block-based carry/reschedule.
 */

/**
 * Place the clock time of `clock` onto `toDate`'s calendar date. The hour/minute
 * stay the same; only the date changes. No post-midnight wrapping — a 1 AM block
 * shifted to June 22 lands at 1 AM June 22 and appears on whichever day's grid
 * window includes that timestamp.
 */
function clockOntoGridDay(clock: Date, toDate: Date): Date {
  const result = startOfDay(toDate);
  result.setHours(
    clock.getHours(),
    clock.getMinutes(),
    clock.getSeconds(),
    clock.getMilliseconds(),
  );
  return result;
}

/**
 * Move a [start, end?] span onto `toDate`'s grid day, keeping the clock time and
 * exact length (ms). Spans may arrive as ISO strings over the wire, so callers
 * pass raw values and we normalize here like day.ts does. Shared by the planned
 * and actual shifts so the clock/duration-preserving rule lives in one place —
 * `blocks.ts` reuses it too (same rule for task_blocks, no re-implementation).
 */
export function shiftSpanOntoGridDay(
  rawStart: Date | string,
  rawEnd: Date | string | null,
  toDate: Date,
): { start: Date; end?: Date } {
  const start = new Date(rawStart);
  const newStart = clockOntoGridDay(start, toDate);
  if (!rawEnd) return { start: newStart };
  const end = new Date(rawEnd);
  // Preserve the exact span length (ms) rather than re-deriving from minutes.
  return {
    start: newStart,
    end: new Date(newStart.getTime() + (end.getTime() - start.getTime())),
  };
}
