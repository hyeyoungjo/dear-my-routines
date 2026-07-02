import { DEFAULT_GRID_END_HOUR } from "./calendar";
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
 * Place the clock time of `clock` onto the *grid day* anchored at `toDate` — not
 * merely its calendar date. That distinction matters only for cross-midnight
 * grids (`gridEndHour > 24`, ADR-013's 07:00→02:00 logical day): the visible grid
 * for day D is the window [D 07:00, D+gridEndHour), so a post-midnight clock hour
 * (`h < gridEndHour - 24`, e.g. 01:00 on a 26h grid) actually belongs to the NEXT
 * calendar date to fall inside D's window. Without this, "continue to tomorrow"
 * on a 1 AM block produced `tomorrow 01:00`, which lands back in *today's* window
 * and reappears on today's grid (the bug this fixes). For a non-crossing grid
 * (`gridEndHour <= 24`) there is no overhang and this is a plain calendar-date set.
 */
function clockOntoGridDay(
  clock: Date,
  toDate: Date,
  gridEndHour: number,
): Date {
  const result = startOfDay(toDate);
  const overhangHours = gridEndHour - 24;
  // Post-midnight overhang hours belong to toDate's grid day but the next
  // calendar date. Bump the date so the timestamp lands in the right window.
  if (overhangHours > 0 && clock.getHours() < overhangHours) {
    result.setDate(result.getDate() + 1);
  }
  result.setHours(
    clock.getHours(),
    clock.getMinutes(),
    clock.getSeconds(),
    clock.getMilliseconds(),
  );
  return result;
}

/**
 * Move a [start, end?] span onto the grid day anchored at `toDate`, keeping the
 * clock time and exact length (ms). Spans may arrive as ISO strings over the
 * wire, so callers pass raw values and we normalize here like day.ts does.
 * Shared by the planned and actual shifts so the clock/duration-preserving rule
 * lives in one place — `blocks.ts` reuses it too (same rule for task_blocks).
 *
 * `gridEndHour` is the user's grid end hour so cross-midnight grids place the
 * post-midnight overhang on the correct day (see `clockOntoGridDay`). It defaults
 * to the non-crossing 24 — the historical behaviour — so callers that don't (or
 * can't) know the setting are unchanged; the live carry paths pass the real value.
 */
export function shiftSpanOntoGridDay(
  rawStart: Date | string,
  rawEnd: Date | string | null,
  toDate: Date,
  gridEndHour: number = DEFAULT_GRID_END_HOUR,
): { start: Date; end?: Date } {
  const start = new Date(rawStart);
  const newStart = clockOntoGridDay(start, toDate, gridEndHour);
  if (!rawEnd) return { start: newStart };
  const end = new Date(rawEnd);
  // Preserve the exact span length (ms) rather than re-deriving from minutes.
  return {
    start: newStart,
    end: new Date(newStart.getTime() + (end.getTime() - start.getTime())),
  };
}
