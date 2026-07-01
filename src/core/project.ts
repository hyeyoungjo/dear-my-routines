/**
 * Pure logic for project states (ADR-028). A project carries two independent,
 * nullable timestamps that mirror the shelf pattern (ADR-026):
 *   - `deactivatedAt` → the project is parked in the Shelf (not active).
 *   - `hiddenAt`      → the project's task blocks are hidden from the calendar.
 * Neither can be derived from plans/actions, so both are stored on the row; these
 * helpers keep the legend, assign picker, Shelf column and calendar filter free of
 * DB/React (CLAUDE.md CRITICAL: core is pure). State is read by null-ness only —
 * the value may be an ISO string (wire) or a Date (memory).
 */

/** Just the state fields this module reads (avoids importing the db row type). */
export type ProjectState = {
  projectId: string;
  deactivatedAt: string | Date | null;
  hiddenAt: string | Date | null;
};

/** Active = not deactivated. (null deactivatedAt) */
export function isProjectActive(p: Pick<ProjectState, "deactivatedAt">): boolean {
  return p.deactivatedAt == null;
}

/** Hidden from the calendar = hiddenAt set. */
export function isProjectHidden(p: Pick<ProjectState, "hiddenAt">): boolean {
  return p.hiddenAt != null;
}

/** Only the active projects (for the legend + assign picker). */
export function activeProjects<T extends Pick<ProjectState, "deactivatedAt">>(
  projects: T[],
): T[] {
  return projects.filter(isProjectActive);
}

/** Only the deactivated ones (for the Shelf column). */
export function deactivatedProjects<T extends Pick<ProjectState, "deactivatedAt">>(
  projects: T[],
): T[] {
  return projects.filter((p) => !isProjectActive(p));
}

/** The set of projectIds whose tasks should be hidden from the calendar. */
export function hiddenProjectIds(projects: ProjectState[]): Set<string> {
  return new Set(projects.filter(isProjectHidden).map((p) => p.projectId));
}

/**
 * Whether a block belongs to a hidden project. `taskProjectId` may be null
 * (unassigned task) → always visible. Used by the calendar block filter.
 */
export function isBlockProjectHidden(
  taskProjectId: string | null,
  hidden: ReadonlySet<string>,
): boolean {
  return taskProjectId != null && hidden.has(taskProjectId);
}
