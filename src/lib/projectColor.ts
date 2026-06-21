/**
 * Stable colour tag for a task's parent project (PRD "프로젝트별 색"). A task
 * inherits a dot colour from the Project it lives under so work from the same
 * project reads as one strand across the calendar. The colour is derived from a
 * deterministic hash of the project id, so the same project always maps to the
 * same palette entry without storing anything. Tasks with no parent project
 * return null (no dot).
 */

/** Fixed, theme-agnostic palette — used only as a small point of colour. */
const PALETTE = [
  "#7c5cff", // violet
  "#0ea5e9", // sky
  "#10b981", // emerald
  "#f59e0b", // amber
  "#ef4444", // red
  "#ec4899", // pink
  "#8b5cf6", // purple
  "#14b8a6", // teal
] as const;

export function projectColor(projectId: string | null | undefined): string | null {
  if (!projectId) return null;
  let hash = 0;
  for (let i = 0; i < projectId.length; i++) {
    hash = (hash * 31 + projectId.charCodeAt(i)) >>> 0;
  }
  return PALETTE[hash % PALETTE.length];
}
