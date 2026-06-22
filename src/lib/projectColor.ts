/**
 * Stable colour tag for a task's parent project (PRD "프로젝트별 색"). A task
 * inherits a dot colour from the Project it lives under so work from the same
 * project reads as one strand across the calendar. The colour is derived from a
 * deterministic hash of the project id, so the same project always maps to the
 * same palette entry without storing anything. Tasks with no parent project
 * return null (no dot).
 */

/**
 * Preset palette offered in the colour picker, and the deterministic fallback
 * for projects with no explicit colour. Theme-agnostic, vivid enough to read as
 * a point of colour on either canvas — one full hue wheel, 8 per row.
 */
export const PROJECT_COLORS = [
  "#ef4444", // red
  "#f97316", // orange
  "#f59e0b", // amber
  "#eab308", // yellow
  "#84cc16", // lime
  "#22c55e", // green
  "#10b981", // emerald
  "#14b8a6", // teal
  "#06b6d4", // cyan
  "#0ea5e9", // sky
  "#3b82f6", // blue
  "#6366f1", // indigo
  "#8b5cf6", // violet
  "#a855f7", // purple
  "#d946ef", // fuchsia
  "#ec4899", // pink
] as const;

export function projectColor(projectId: string | null | undefined): string | null {
  if (!projectId) return null;
  let hash = 0;
  for (let i = 0; i < projectId.length; i++) {
    hash = (hash * 31 + projectId.charCodeAt(i)) >>> 0;
  }
  return PROJECT_COLORS[hash % PROJECT_COLORS.length];
}
