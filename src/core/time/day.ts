/**
 * Day scoping for the calendar (CLAUDE.md CRITICAL — date math lives in `core/`,
 * never in components). Blocks are attributed to the calendar date their startAt
 * timestamp falls on (midnight–midnight). What appears on a given day's grid is
 * determined by the configurable time window in plansForDay / actionsForDay, not
 * by a hardcoded "logical day" boundary — that keeps data and visualisation separate.
 *
 * Per-day attribution of work now lives on `task_blocks` (ADR-014); these
 * helpers are the pure date math (keys, calendar-day boundary, month grid) that the
 * block-scoping in plan.ts / action.ts and the calendar UI build on.
 */

/** Local calendar key `YYYY-MM-DD` (timezone = the runtime's local zone). */
export function dayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Inverse of `dayKey`: parse a `YYYY-MM-DD` key into that day's local midnight. */
export function dayFromKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/**
 * The calendar date a timestamp belongs to — simply the date component of the
 * local timestamp, no wrap. Display filtering (which blocks appear on a given
 * day's grid) uses a configurable time window in plansForDay / actionsForDay.
 */
export function gridDayOf(ts: Date): string {
  return dayKey(ts);
}

/** Local midnight of `date` — the canonical anchor for a selected day. */
export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** `date` shifted by `n` whole days (negative = backward), immutably. */
export function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

/** Whether two dates fall in the same calendar month (and year). */
export function isSameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

/**
 * The calendar grid for the month containing `date`: 6 weeks × 7 days, each day
 * at local midnight, Sunday-first. Always 6 rows so the picker's height never
 * jumps between months; leading/trailing days spill into the neighbouring months
 * (callers dim them via `isSameMonth`). Pure geometry — no UI, no DB.
 */
export function monthGrid(date: Date): Date[][] {
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  // Back up to the Sunday on or before the 1st (getDay: Sun=0 … Sat=6).
  const start = addDays(first, -first.getDay());
  const weeks: Date[][] = [];
  let cursor = start;
  for (let w = 0; w < 6; w++) {
    const week: Date[] = [];
    for (let d = 0; d < 7; d++) {
      week.push(cursor);
      cursor = addDays(cursor, 1);
    }
    weeks.push(week);
  }
  return weeks;
}
