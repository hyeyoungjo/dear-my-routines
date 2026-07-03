/**
 * Selectable calendar row heights — pixels per grid hour. Mirrors the font/
 * language preference shape (@/lib/fonts, @/lib/languages): a small allowlist
 * with a default and a type guard the route handler uses to validate the
 * persisted value. 48px (1x) was the original fixed height; 72px (1.5x) is
 * the current default — more breathing room for block text.
 */
export const SLOT_HEIGHT_OPTIONS = [48, 72, 96] as const;

export type SlotHeight = (typeof SLOT_HEIGHT_OPTIONS)[number];

export const DEFAULT_SLOT_HEIGHT: SlotHeight = 72;

export function isAllowedSlotHeight(value: unknown): value is SlotHeight {
  return SLOT_HEIGHT_OPTIONS.includes(value as SlotHeight);
}
