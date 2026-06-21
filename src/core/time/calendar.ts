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
