import { GRID_START_HOUR } from "./calendar";
import { addDays, startOfDay } from "./day";

/**
 * Pure span-shift math for carry-over and reschedule (ADR-013/014). No React, no
 * DB, no network (CLAUDE.md CRITICAL). The day-boundary rule is NOT redefined
 * here: the 07:00 → 02:00 grid boundary lives in `day.ts`/`calendar.ts`.
 *
 * Per-day placement now lives on `task_blocks`, so the node-level carry helpers
 * are gone (ADR-014); `blocks.ts` reuses `shiftSpanOntoGridDay` below for the
 * block-based carry/reschedule.
 */

/**
 * Place a clock time (hour/minute/second of `clock`) on the calendar so that its
 * *grid day* equals `dayKey(toDate)`. Daytime times (≥ 07:00) land on toDate's
 * own calendar date; post-midnight times (00:00–06:59) are the tail of the grid
 * and therefore land on the *next* calendar date, exactly the inverse of
 * `gridDayOf`'s wrap. This is what keeps "where the block is drawn" and "which
 * day it counts toward" in agreement after a carry.
 */
function clockOntoGridDay(clock: Date, toDate: Date): Date {
  const result = startOfDay(toDate);
  result.setHours(
    clock.getHours(),
    clock.getMinutes(),
    clock.getSeconds(),
    clock.getMilliseconds(),
  );
  // A pre-07:00 time belongs to the previous grid day, so to anchor it to
  // toDate's grid day its calendar date must be the day after toDate.
  if (clock.getHours() < GRID_START_HOUR) {
    return addDays(result, 1);
  }
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
