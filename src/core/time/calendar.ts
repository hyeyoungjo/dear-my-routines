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
