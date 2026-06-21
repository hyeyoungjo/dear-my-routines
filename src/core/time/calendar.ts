/**
 * Pure time-grid geometry for the calendar (CLAUDE.md CRITICAL — time math lives
 * in `core/`, never in components). The day runs 07:00 → 02:00 the next morning
 * (PRD "하루를 한눈에"), so post-midnight hours (00:00–06:59) wrap to the end of
 * the grid rather than the start.
 *
 * Everything here is expressed in *minutes from the grid start* (07:00 = 0). The
 * UI multiplies those minutes by a pixel-per-minute scale; the conversion to
 * pixels is the component's concern, the schedule arithmetic is ours.
 */

/** First hour shown on the grid (07:00). */
export const GRID_START_HOUR = 7;
/** Last boundary shown, expressed past midnight: 02:00 next day = 24 + 2. */
export const GRID_END_HOUR = 26;
/** Total minutes the grid spans (07:00 → 02:00 = 19h = 1140m). */
export const GRID_TOTAL_MINUTES = (GRID_END_HOUR - GRID_START_HOUR) * 60;

/** One labelled boundary on the time axis. */
export type GridSlot = { offsetMinutes: number; label: string };

/**
 * Hourly boundaries from 07:00 through 02:00 (next day), inclusive — 20 labels.
 * `offsetMinutes` is measured from the grid start; `label` is 24h `HH:00`.
 */
export function gridSlots(): GridSlot[] {
  const slots: GridSlot[] = [];
  for (let hour = GRID_START_HOUR; hour <= GRID_END_HOUR; hour++) {
    slots.push({
      offsetMinutes: (hour - GRID_START_HOUR) * 60,
      label: `${String(hour % 24).padStart(2, "0")}:00`,
    });
  }
  return slots;
}

/**
 * Minutes from the grid start (07:00) for a wall-clock hour+minute. Times before
 * 07:00 belong to the post-midnight tail, so they wrap a full day forward.
 */
export function minutesFromGridStart(hour: number, minute: number): number {
  const wrapped = hour < GRID_START_HOUR ? hour + 24 : hour;
  return (wrapped - GRID_START_HOUR) * 60 + minute;
}

/** Grid offset (minutes from 07:00) of a planned/actual start time. */
export function blockTopMinutes(start: Date): number {
  return minutesFromGridStart(start.getHours(), start.getMinutes());
}

/** Whole minutes between two times (end − start), rounded. */
export function durationMinutes(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / 60000);
}

/**
 * A concrete Date for a grid offset on a given base day. The base day's calendar
 * date anchors 07:00; adding the offset (which may exceed 24h-from-midnight)
 * rolls into the next day automatically via `setMinutes`.
 */
export function slotDate(baseDay: Date, offsetMinutes: number): Date {
  const date = new Date(baseDay);
  date.setHours(GRID_START_HOUR, 0, 0, 0);
  date.setMinutes(date.getMinutes() + offsetMinutes);
  return date;
}

/**
 * Snap a raw minute offset down to its containing hour slot, clamped to the grid
 * (used when turning a click position into a new block's start).
 */
export function snapToSlot(offsetMinutes: number): number {
  const clamped = Math.max(0, Math.min(offsetMinutes, GRID_TOTAL_MINUTES - 60));
  return Math.floor(clamped / 60) * 60;
}

// --- Drag / resize geometry (step 2) --------------------------------------

/** Snap step for dragging and resizing — 15-minute grid (Google-Calendar feel). */
export const SNAP_MINUTES = 15;
/** A block may never be resized shorter than this (prevents zero/negative spans). */
export const MIN_BLOCK_MINUTES = 15;

/** A scheduled span as concrete start/end Dates. */
export type Span = { start: Date; end: Date };

/** Round a raw minute delta to the nearest snap step. */
export function snapMinutes(delta: number, step: number = SNAP_MINUTES): number {
  return Math.round(delta / step) * step;
}

/** A new Date `minutes` after `date` (immutable — never mutates the input). */
export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60000);
}

/**
 * Shift a whole block by a minute delta, preserving its duration (drag-to-move).
 * Both edges move together, so the gap between start and end is unchanged.
 */
export function moveBlock(start: Date, end: Date, deltaMinutes: number): Span {
  return {
    start: addMinutes(start, deltaMinutes),
    end: addMinutes(end, deltaMinutes),
  };
}

/**
 * Resize a block's bottom edge by a minute delta. The end is clamped so the
 * block never becomes shorter than MIN_BLOCK_MINUTES — this prevents a zero or
 * inverted (end before start) span when the user drags the edge upward.
 */
export function resizeBlockEnd(start: Date, end: Date, deltaMinutes: number): Span {
  const proposed = durationMinutes(start, end) + deltaMinutes;
  const duration = Math.max(MIN_BLOCK_MINUTES, proposed);
  return { start, end: addMinutes(start, duration) };
}

// --- Parent / child nesting (phase 3) -------------------------------------

/**
 * Clamp a child span fully inside its parent's [start, end] window (rule A): a
 * child starting before the parent is pushed to the parent's start, one ending
 * after the parent is clipped to the parent's end. If clipping would invert the
 * span (start past end) it collapses to a zero-length span at the boundary. Pure
 * — inputs are not mutated. Used to seed a new subtask inside its parent's range.
 */
export function clampChildToParent(child: Span, parent: Span): Span {
  const lo = parent.start.getTime();
  const hi = parent.end.getTime();
  const start = Math.min(Math.max(child.start.getTime(), lo), hi);
  const end = Math.max(Math.min(child.end.getTime(), hi), start);
  return { start: new Date(start), end: new Date(end) };
}

/**
 * Grow a parent span so it fully wraps its children: the result starts at the
 * earliest of the parent and any child start, and ends at the latest of the
 * parent and any child end. With no children the parent is returned unchanged.
 * This is what makes a "subproject-sized" task visibly stretch its block when
 * its subtasks overflow the original estimate (PRD). Pure — never mutates input.
 */
export function fitParentToChildren(parent: Span, children: Span[]): Span {
  let start = parent.start.getTime();
  let end = parent.end.getTime();
  for (const child of children) {
    start = Math.min(start, child.start.getTime());
    end = Math.max(end, child.end.getTime());
  }
  return { start: new Date(start), end: new Date(end) };
}

// --- Nested block pixel layout (phase 4) ----------------------------------

/**
 * The minimal shape `blockPixelHeight`/`childOffsetPx` need from a laid-out
 * block: its effective span (already grown to wrap children) and its children,
 * recursively. The calendar's richer `CalBlock` structurally satisfies this, so
 * the geometry stays pure (`core/`) and never imports a UI type.
 */
export type LaidOutBlock = {
  span: Span;
  children: LaidOutBlock[];
};

/**
 * Vertical pixel offset of a child *inside* its parent block, measured from the
 * parent's top edge: it starts just below the parent's fixed title header
 * (`headerPx`) and drops proportionally to how far past the parent's start the
 * child begins. This is what keeps a child time-aligned without the header
 * eating into its time span (the bug this phase fixes).
 */
export function childOffsetPx(
  parentStart: Date,
  childStart: Date,
  pxPerMinute: number,
  headerPx: number,
): number {
  return headerPx + durationMinutes(parentStart, childStart) * pxPerMinute;
}

/**
 * Total pixel height of a block so it fully wraps its title header *and* every
 * child (frame-in-frame, arbitrary depth — ADR-009). Because each nested level
 * carries its own fixed `headerPx`, a child's real pixel footprint is taller
 * than its bare time span, so the parent must grow to the lowest of:
 *  - its own header plus its own time span (the floor when it has no children),
 *  - each child's offset (`childOffsetPx`) plus that child's full pixel height,
 *    computed recursively.
 * Pure — depends only on spans, the per-minute scale, and the header constant.
 */
export function blockPixelHeight(
  block: LaidOutBlock,
  pxPerMinute: number,
  headerPx: number,
): number {
  const ownMinutes = durationMinutes(block.span.start, block.span.end);
  let bottom = headerPx + ownMinutes * pxPerMinute;
  for (const child of block.children) {
    const top = childOffsetPx(
      block.span.start,
      child.span.start,
      pxPerMinute,
      headerPx,
    );
    const childBottom = top + blockPixelHeight(child, pxPerMinute, headerPx);
    if (childBottom > bottom) bottom = childBottom;
  }
  return bottom;
}

// --- Plan vs. actual presentation (step 3) --------------------------------

/**
 * Human-readable duration for the planned-vs-actual comparison label
 * (PRD "예상 vs. 실제" — e.g. `~1.5h → 2.1h`). Under an hour reads as minutes
 * (`45m`); an hour or more reads as hours with one decimal, dropping a trailing
 * `.0` so a whole hour is `1h`, not `1.0h`.
 */
export function formatHours(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = minutes / 60;
  return Number.isInteger(hours) ? `${hours}h` : `${hours.toFixed(1)}h`;
}
