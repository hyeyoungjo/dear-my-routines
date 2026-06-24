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

/** First hour shown on the grid (07:00) — used as the data-layer default. */
export const GRID_START_HOUR = 7;
/** Last boundary shown, expressed past midnight: 02:00 next day = 24 + 2. */
export const GRID_END_HOUR = 26;
/** Total minutes the grid spans (07:00 → 02:00 = 19h = 1140m). */
export const GRID_TOTAL_MINUTES = (GRID_END_HOUR - GRID_START_HOUR) * 60;

/** Default grid hours surfaced in the settings UI. */
export const DEFAULT_GRID_START_HOUR = 7;
export const DEFAULT_GRID_END_HOUR = 24;

/** One labelled boundary on the time axis. */
export type GridSlot = { offsetMinutes: number; label: string };

/**
 * Hourly boundaries for the given start/end hours, inclusive.
 * `offsetMinutes` is measured from `startHour`; `label` is 24h `HH:00`.
 */
export function gridSlots(
  startHour = GRID_START_HOUR,
  endHour = GRID_END_HOUR,
): GridSlot[] {
  const slots: GridSlot[] = [];
  for (let hour = startHour; hour <= endHour; hour++) {
    slots.push({
      offsetMinutes: (hour - startHour) * 60,
      label: `${String(hour % 24).padStart(2, "0")}:00`,
    });
  }
  return slots;
}

/**
 * Minutes from the grid start for a wall-clock hour+minute. Times before
 * `startHour` belong to the post-midnight tail and wrap a full day forward.
 */
export function minutesFromGridStart(
  hour: number,
  minute: number,
  startHour = GRID_START_HOUR,
): number {
  const wrapped = hour < startHour ? hour + 24 : hour;
  return (wrapped - startHour) * 60 + minute;
}

/** Grid offset (minutes from grid start) of a block's start time. */
export function blockTopMinutes(start: Date, startHour = GRID_START_HOUR): number {
  return minutesFromGridStart(start.getHours(), start.getMinutes(), startHour);
}

/** Whole minutes between two times (end − start), rounded. */
export function durationMinutes(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / 60000);
}

/**
 * A concrete Date for a grid offset on a given base day. The base day's calendar
 * date anchors at `startHour`; adding the offset rolls into the next day automatically.
 */
export function slotDate(
  baseDay: Date,
  offsetMinutes: number,
  startHour = GRID_START_HOUR,
): Date {
  const date = new Date(baseDay);
  date.setHours(startHour, 0, 0, 0);
  date.setMinutes(date.getMinutes() + offsetMinutes);
  return date;
}

/**
 * Snap a raw minute offset down to its containing hour slot, clamped to the grid
 * (used when turning a click position into a new block's start).
 */
export function snapToSlot(
  offsetMinutes: number,
  totalMinutes = GRID_TOTAL_MINUTES,
): number {
  const clamped = Math.max(0, Math.min(offsetMinutes, totalMinutes - 60));
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

// --- Nested block pixel layout (phase 5) ----------------------------------

/**
 * The minimal shape `blockPixelHeight` needs from a laid-out block: its
 * effective span, already grown to wrap its children (`fitParentToChildren`).
 * The calendar's richer `CalBlock` structurally satisfies this, so the geometry
 * stays pure (`core/`) and never imports a UI type.
 */
export type LaidOutBlock = {
  span: Span;
};

/**
 * Vertical pixel offset of a child *inside* its parent block, measured from the
 * parent's top edge: purely how far past the parent's start the child begins,
 * in pixels. The title is drawn as a zero-height overlay (it no longer occupies
 * layout space), so a child is positioned by time alone and stays exactly on the
 * shared axis — the bug this phase fixes, where a fixed header ate into the span.
 */
export function childOffsetPx(
  parentStart: Date,
  childStart: Date,
  pxPerMinute: number,
): number {
  return durationMinutes(parentStart, childStart) * pxPerMinute;
}

/**
 * Pixel height of a block: simply its effective time span (already grown to wrap
 * every child via `fitParentToChildren`, so the children's footprints are inside
 * it — ADR-009 frame-in-frame). Because the title is a zero-layout overlay, the
 * height is pure time and the time axis stays exact at any nesting depth.
 */
export function blockPixelHeight(
  block: LaidOutBlock,
  pxPerMinute: number,
): number {
  return durationMinutes(block.span.start, block.span.end) * pxPerMinute;
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

// --- Overlap layout (Google-Calendar side-by-side) ------------------------

/** A laid-out item's horizontal slot: its column index and the band's column count. */
export type OverlapSlot = { col: number; cols: number };

/**
 * Lay out time-overlapping items side by side, Google-Calendar style. A maximal
 * run of items connected by overlap forms a "cluster" that shares a width; each
 * item takes the first free column, and the cluster's column count (capped at
 * `maxCols`) becomes every member's `cols`. Items that don't overlap anything get
 * a full-width single column. The UI turns `{col, cols}` into left/width
 * fractions. Pure — sorts a copy, never mutates inputs.
 */
export function layoutOverlaps<
  T extends { span: Span; node: { sortOrder: number } },
>(items: T[], maxCols = 4): Map<T, OverlapSlot> {
  const result = new Map<T, OverlapSlot>();
  // Scan in start order to group items into overlap clusters.
  const byStart = [...items].sort(
    (a, b) => a.span.start.getTime() - b.span.start.getTime(),
  );

  let cluster: T[] = [];
  let clusterEnd = Number.NEGATIVE_INFINITY;

  const flush = () => {
    if (cluster.length === 0) return;
    // Within the cluster, place items left-to-right by the user-set column order
    // (sortOrder), each taking the first column free of an *overlapping* sibling.
    // So dragging a block to change its sortOrder changes which column it lands in.
    const ordered = [...cluster].sort(
      (a, b) =>
        a.node.sortOrder - b.node.sortOrder ||
        a.span.start.getTime() - b.span.start.getTime(),
    );
    const placed: { item: T; col: number }[] = [];
    let maxCol = 0;
    for (const item of ordered) {
      const s = item.span.start.getTime();
      const e = item.span.end.getTime();
      const used = new Set(
        placed
          .filter(
            (p) =>
              p.item.span.start.getTime() < e && p.item.span.end.getTime() > s,
          )
          .map((p) => p.col),
      );
      let col = 0;
      while (used.has(col)) col++;
      placed.push({ item, col });
      maxCol = Math.max(maxCol, col);
    }
    const cols = Math.min(maxCol + 1, maxCols);
    for (const p of placed) {
      result.set(p.item, { col: Math.min(p.col, cols - 1), cols });
    }
    cluster = [];
  };

  for (const item of byStart) {
    if (cluster.length > 0 && item.span.start.getTime() >= clusterEnd) {
      flush();
      clusterEnd = Number.NEGATIVE_INFINITY;
    }
    cluster.push(item);
    clusterEnd = Math.max(clusterEnd, item.span.end.getTime());
  }
  flush();

  return result;
}
