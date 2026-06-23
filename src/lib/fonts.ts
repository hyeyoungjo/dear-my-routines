/**
 * Selectable UI fonts. Mirrors the language preference shape (see
 * `@/lib/languages`): a small allowlist with a default and a type guard the
 * route handler uses to validate the persisted value.
 *
 * `variable` is the CSS custom property each font is exposed under by
 * `next/font/local` in `app/layout.tsx`; `globals.css` switches the active
 * font by mapping `[data-font="<id>"]` → that variable.
 *
 * All four fonts ship under the SIL Open Font License 1.1 (commercial use
 * allowed); the license copies live alongside the files in `app/fonts/`.
 */
export const FONTS = [
  { id: "nanum-gothic", label: "Nanum Gothic", variable: "--font-nanum-gothic" },
  { id: "gowun-batang", label: "Gowun Batang", variable: "--font-gowun-batang" },
  { id: "hi-melody", label: "Hi Melody", variable: "--font-hi-melody" },
  {
    id: "nanum-brush-script",
    label: "Nanum Brush Script",
    variable: "--font-nanum-brush-script",
  },
  {
    id: "nanum-pen-script",
    label: "Nanum Pen Script",
    variable: "--font-nanum-pen-script",
  },
] as const;

export type FontId = (typeof FONTS)[number]["id"];

export const DEFAULT_FONT_ID: FontId = "nanum-gothic";

export function isAllowedFont(id: unknown): id is FontId {
  return FONTS.some((f) => f.id === id);
}
