import type { FlatNode } from "@/core/tree/types";
import { GRID_START_HOUR } from "./calendar";

/**
 * Day scoping for the calendar (CLAUDE.md CRITICAL — date math lives in `core/`,
 * never in components). A "day" here is the *grid day*: the calendar runs
 * 07:00 → 02:00 the next morning (see calendar.ts), so a 00:00–06:59 timestamp
 * is the tail of the previous calendar day, not the head of its own.
 *
 * These pure predicates are how the normalized `nodes` rows (the source of
 * truth) get assembled into the "one day" view the UI navigates — the JSON-ish
 * shape the user sees is a read model over the rows, never a stored blob
 * (ADR-013).
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
 * Which grid day a timestamp belongs to. Mirrors `minutesFromGridStart`'s
 * `hour < GRID_START_HOUR` wrap so that *where a block is drawn* and *which day
 * it counts toward* always agree: a 01:00 block sits at the bottom of a day's
 * grid and belongs to that same (previous calendar) day.
 */
export function gridDayOf(ts: Date): string {
  const d = new Date(ts);
  if (d.getHours() < GRID_START_HOUR) {
    d.setDate(d.getDate() - 1);
  }
  return dayKey(d);
}

/**
 * Does a node belong to the given day?
 * - Placed on the grid → anchored by its planned (else actual) start's grid day.
 * - Not yet placed → falls back to its `plannedDate` column (the carry-over /
 *   morning-plan date, ADR-009), which is already a `YYYY-MM-DD` string.
 * - Neither → belongs to no day.
 */
export function nodeBelongsToDay(node: FlatNode, date: Date): boolean {
  const key = dayKey(date);
  const span = node.plannedStart ?? node.actualStart;
  // Spans may arrive as ISO strings over the wire; normalize before reading.
  if (span) return gridDayOf(new Date(span)) === key;
  if (node.plannedDate) return node.plannedDate === key;
  return false;
}

/** The subset of nodes that belong to `date` (see `nodeBelongsToDay`). */
export function nodesForDay(nodes: FlatNode[], date: Date): FlatNode[] {
  return nodes.filter((node) => nodeBelongsToDay(node, date));
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
