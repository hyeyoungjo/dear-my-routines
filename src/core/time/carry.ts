import type { FlatNode } from "@/core/tree/types";
import { GRID_START_HOUR } from "./calendar";
import { addDays, dayKey, gridDayOf, startOfDay } from "./day";

/**
 * Carry-over of undone tasks (ADR-009). Pure date/tree math only — no React, no
 * DB, no network (CLAUDE.md CRITICAL). The day-boundary rules are NOT redefined
 * here: every grid-day decision delegates to `day.ts` (`gridDayOf`, `dayKey`),
 * so the 07:00 → 02:00 boundary (ADR-013) lives in exactly one place.
 *
 * Each function returns a *patch* (only the changed fields), so a caller can hand
 * it straight to an update mutation (the optimistic update of ADR-007).
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
 * Move a node's planned span to `toDate`, keeping the clock time and duration.
 * Only the calendar date changes — a task planned 14:00–15:30 carried to the
 * next day becomes 14:00–15:30 on that day. If the node has no plannedStart but
 * has a plannedDate, shift plannedDate instead. Returns ONLY the changed fields
 * (a patch), so callers can hand it straight to an update mutation.
 */
export function shiftPlannedToDate(
  node: FlatNode,
  toDate: Date,
): Partial<FlatNode> {
  // No placed span → only the (unplaced) plannedDate moves.
  if (!node.plannedStart) {
    return { plannedDate: dayKey(toDate) };
  }

  // Spans may arrive as ISO strings over the wire; normalize like day.ts does.
  const start = new Date(node.plannedStart);
  const newStart = clockOntoGridDay(start, toDate);

  const patch: Partial<FlatNode> = {
    plannedStart: newStart,
    // Keep plannedDate consistent with the span's grid day so the two never
    // disagree (ADR-013: rows are the source of truth, kept coherent).
    plannedDate: dayKey(toDate),
  };

  if (node.plannedEnd) {
    const end = new Date(node.plannedEnd);
    // Preserve the exact span length (ms) rather than re-deriving from minutes.
    patch.plannedEnd = new Date(newStart.getTime() + (end.getTime() - start.getTime()));
  }

  return patch;
}

/**
 * Carry an undone task forward: shiftPlannedToDate(node, toDate) PLUS
 * carryCount + 1 and status "carried". This is the patch applied both when the
 * user explicitly says "didn't do it" (step 1) and when the day-boundary sweep
 * pulls a past-due task forward (step 2).
 */
export function carryOverNode(node: FlatNode, toDate: Date): Partial<FlatNode> {
  return {
    ...shiftPlannedToDate(node, toDate),
    carryCount: (node.carryCount ?? 0) + 1,
    status: "carried",
  };
}

/**
 * The nodes that the day-boundary sweep should pull forward to `today`:
 * past-due, not done, not yet acted on. A node qualifies only when ALL hold:
 * - its grid day (plannedStart's, else plannedDate) is strictly before today's
 *   grid day — same or later is excluded, which is the idempotency core: a node
 *   already moved to today is never dragged forward again;
 * - status is pending or in_progress (done/carried/dropped excluded);
 * - it has no actualStart (a task already acted on is left alone);
 * - it is a task or subtask (area/project containers are not carried).
 */
export function findOverdueUncarried(
  nodes: FlatNode[],
  today: Date,
): FlatNode[] {
  const todayGridDay = gridDayOf(today);
  return nodes.filter((node) => {
    if (node.type !== "task" && node.type !== "subtask") return false;
    if (node.status !== "pending" && node.status !== "in_progress") return false;
    if (node.actualStart) return false;

    // Where the node currently sits: placed span wins, else its plannedDate
    // (already a grid-day key); neither → it belongs to no day, so not overdue.
    let nodeGridDay: string;
    if (node.plannedStart) {
      nodeGridDay = gridDayOf(new Date(node.plannedStart));
    } else if (node.plannedDate) {
      nodeGridDay = node.plannedDate;
    } else {
      return false;
    }

    // YYYY-MM-DD sorts lexicographically the same as chronologically.
    return nodeGridDay < todayGridDay;
  });
}
