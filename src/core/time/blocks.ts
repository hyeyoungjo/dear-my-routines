import type { Span } from "./calendar";
import { dayKey, gridDayOf } from "./day";
import { shiftSpanOntoGridDay } from "./carry";

/**
 * Pure business logic for `task_blocks` (ADR-014): a task's *occurrences* across
 * grid days. `nodes` carries task identity + the stats unit; a block is one
 * date's planned + actual placement of that task (1:N from a node). Carry-over,
 * day-attribution and the *derived* per-task dates (planned/revised/actual) and
 * carryCount all live here — no React, no DB, no network (CLAUDE.md CRITICAL).
 *
 * The day-boundary (07:00 → 02:00, ADR-013) and the clock/duration-preserving
 * shift are NOT redefined here: they delegate to `day.ts` and `carry.ts` so the
 * single source of truth stays intact. Timestamps may arrive as ISO strings over
 * the wire, so we normalize with `new Date(...)` before reading them (day.ts
 * pattern) and emit ISO strings in patches to match the wire shape.
 */

/** A task_block as it arrives over the wire (timestamps may be ISO strings). */
export type FlatBlock = {
  id: string;
  nodeId: string;
  gridDay: string;
  plannedStart: string | null;
  plannedEnd: string | null;
  actualStart: string | null;
  actualEnd: string | null;
  status: "planned" | "done" | "missed";
  sortOrder: number;
};

/**
 * Which grid day a block belongs to: anchored by its planned (else actual)
 * start's grid day, else its stored `gridDay` column. A block always has a
 * `gridDay`, so the column is the reliable fallback when neither span is placed.
 */
export function blockBelongsToDay(block: FlatBlock, date: Date): boolean {
  const key = dayKey(date);
  const span = block.plannedStart ?? block.actualStart;
  if (span) return gridDayOf(new Date(span)) === key;
  return block.gridDay === key;
}

/** The subset of blocks that belong to `date` (see `blockBelongsToDay`). */
export function blocksForDay(blocks: FlatBlock[], date: Date): FlatBlock[] {
  return blocks.filter((block) => blockBelongsToDay(block, date));
}

/**
 * The plan or actual span of a block as concrete Dates, or null when that pair
 * is not fully set. A span needs both edges — a lone start can't form a Span
 * (calendar.ts `Span` requires start *and* end), so it yields null.
 */
export function blockSpan(block: FlatBlock, kind: "plan" | "actual"): Span | null {
  const rawStart = kind === "plan" ? block.plannedStart : block.actualStart;
  const rawEnd = kind === "plan" ? block.plannedEnd : block.actualEnd;
  if (!rawStart || !rawEnd) return null;
  return { start: new Date(rawStart), end: new Date(rawEnd) };
}

/**
 * Manual reschedule of a block's *planned* span to `toDate`, keeping the clock
 * time and exact duration — only the calendar date changes. The block's stored
 * `gridDay` moves with it so the two never disagree (the block-level counterpart
 * of carry.ts keeping `plannedDate` coherent). Pure reschedule: status untouched
 * (dragging a date is not a carry-over, ADR-009). Empty patch if there is no
 * planned span to move.
 */
export function shiftBlockPlanned(block: FlatBlock, toDate: Date): Partial<FlatBlock> {
  if (!block.plannedStart) return {};
  const { start, end } = shiftSpanOntoGridDay(
    block.plannedStart,
    block.plannedEnd,
    toDate,
  );
  const patch: Partial<FlatBlock> = {
    plannedStart: start.toISOString(),
    gridDay: dayKey(toDate),
  };
  if (end) patch.plannedEnd = end.toISOString();
  return patch;
}

/**
 * Manual reschedule of a block's *actual* span to `toDate`, keeping the clock
 * time and duration. There is no date-only fallback (an actual span exists only
 * once acted on) and it NEVER touches `gridDay` or status — the block stays
 * anchored by its plan. Empty patch when there is no actual span to move.
 */
export function shiftBlockActual(block: FlatBlock, toDate: Date): Partial<FlatBlock> {
  if (!block.actualStart) return {};
  const { start, end } = shiftSpanOntoGridDay(
    block.actualStart,
    block.actualEnd,
    toDate,
  );
  const patch: Partial<FlatBlock> = { actualStart: start.toISOString() };
  if (end) patch.actualEnd = end.toISOString();
  return patch;
}

/**
 * Carry an undone block forward (ADR-014): this block stays `missed` and a brand
 * new planned block is born on `toDate` for the same node, with the plan span
 * shifted (clock + duration kept). Returns BOTH the patch for THIS block and the
 * data for the new one — the caller marks one row missed and inserts the other.
 * The new block carries no actual (it has not been acted on yet) and keeps the
 * source block's `sortOrder`.
 */
export function carryOverBlock(
  block: FlatBlock,
  toDate: Date,
): { missedPatch: Partial<FlatBlock>; nextBlock: Omit<FlatBlock, "id"> } {
  const shifted = block.plannedStart
    ? shiftSpanOntoGridDay(block.plannedStart, block.plannedEnd, toDate)
    : null;
  return {
    missedPatch: { status: "missed" },
    nextBlock: {
      nodeId: block.nodeId,
      gridDay: dayKey(toDate),
      plannedStart: shifted ? shifted.start.toISOString() : null,
      plannedEnd: shifted?.end ? shifted.end.toISOString() : null,
      actualStart: null,
      actualEnd: null,
      status: "planned",
      sortOrder: block.sortOrder,
    },
  };
}

/**
 * The planned blocks the day-boundary sweep should pull forward to `today`:
 * those whose grid day is strictly before today's grid day AND still `planned`
 * (done/missed excluded). Excluding non-planned is the idempotency core — a
 * block already carried (missed) or a fresh block already on today is never
 * dragged forward again. YYYY-MM-DD sorts lexicographically = chronologically.
 */
export function findOverdueBlocks(blocks: FlatBlock[], today: Date): FlatBlock[] {
  const todayGridDay = gridDayOf(today);
  return blocks.filter(
    (block) => block.status === "planned" && block.gridDay < todayGridDay,
  );
}

// --- Per-task derived dates (ADR-014: parities, never stored columns) ------

/** The earliest grid day among a node's blocks — its first planned occurrence. */
export function plannedDateOf(nodeBlocks: FlatBlock[]): string | null {
  if (nodeBlocks.length === 0) return null;
  return nodeBlocks.reduce(
    (min, b) => (b.gridDay < min ? b.gridDay : min),
    nodeBlocks[0].gridDay,
  );
}

/** The latest grid day among a node's still-`planned` blocks (the live plan). */
export function revisedDateOf(nodeBlocks: FlatBlock[]): string | null {
  const planned = nodeBlocks.filter((b) => b.status === "planned");
  if (planned.length === 0) return null;
  return planned.reduce(
    (max, b) => (b.gridDay > max ? b.gridDay : max),
    planned[0].gridDay,
  );
}

/** The grid day of the (latest) block that was actually acted on, else null. */
export function actualDateOf(nodeBlocks: FlatBlock[]): string | null {
  const acted = nodeBlocks.filter((b) => b.actualStart);
  if (acted.length === 0) return null;
  return acted.reduce(
    (max, b) => (b.gridDay > max ? b.gridDay : max),
    acted[0].gridDay,
  );
}

/** How many times this task was carried — the count of `missed` blocks. */
export function carryCountOf(nodeBlocks: FlatBlock[]): number {
  return nodeBlocks.filter((b) => b.status === "missed").length;
}
