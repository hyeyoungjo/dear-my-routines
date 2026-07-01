import { describe, expect, it } from "vitest";
import {
  activeProjects,
  deactivatedProjects,
  hiddenProjectIds,
  isBlockProjectHidden,
  isProjectActive,
  isProjectHidden,
  type ProjectState,
} from "./project";

/** A project with sensible defaults — override what a test needs. */
function project(partial: Partial<ProjectState>): ProjectState {
  return {
    projectId: "p",
    deactivatedAt: null,
    hiddenAt: null,
    ...partial,
  };
}

describe("isProjectActive", () => {
  it("is true when deactivatedAt is null", () => {
    expect(isProjectActive({ deactivatedAt: null })).toBe(true);
  });

  it("is false for a Date deactivatedAt", () => {
    expect(isProjectActive({ deactivatedAt: new Date() })).toBe(false);
  });

  it("is false for an ISO-string deactivatedAt (wire form)", () => {
    expect(isProjectActive({ deactivatedAt: "2026-07-01T12:00:00.000Z" })).toBe(
      false,
    );
  });
});

describe("isProjectHidden", () => {
  it("is false when hiddenAt is null", () => {
    expect(isProjectHidden({ hiddenAt: null })).toBe(false);
  });

  it("is true for a Date hiddenAt", () => {
    expect(isProjectHidden({ hiddenAt: new Date() })).toBe(true);
  });

  it("is true for an ISO-string hiddenAt (wire form)", () => {
    expect(isProjectHidden({ hiddenAt: "2026-07-01T12:00:00.000Z" })).toBe(true);
  });
});

describe("activeProjects / deactivatedProjects", () => {
  const projects = [
    project({ projectId: "a" }),
    project({ projectId: "b", deactivatedAt: new Date() }),
    project({ projectId: "c", deactivatedAt: "2026-07-01T00:00:00.000Z" }),
    project({ projectId: "d" }),
  ];

  it("activeProjects keeps only the non-deactivated ones", () => {
    expect(activeProjects(projects).map((p) => p.projectId)).toEqual(["a", "d"]);
  });

  it("deactivatedProjects keeps only the deactivated ones", () => {
    expect(deactivatedProjects(projects).map((p) => p.projectId)).toEqual([
      "b",
      "c",
    ]);
  });
});

describe("hiddenProjectIds", () => {
  it("collects only hidden project ids", () => {
    const projects = [
      project({ projectId: "a" }),
      project({ projectId: "b", hiddenAt: new Date() }),
      project({ projectId: "c", hiddenAt: "2026-07-01T00:00:00.000Z" }),
    ];
    expect(hiddenProjectIds(projects)).toEqual(new Set(["b", "c"]));
  });

  it("is an empty set when no project is hidden", () => {
    const projects = [project({ projectId: "a" }), project({ projectId: "b" })];
    expect(hiddenProjectIds(projects).size).toBe(0);
  });
});

describe("isBlockProjectHidden", () => {
  const hidden = new Set(["b", "c"]);

  it("is true for a task in a hidden project", () => {
    expect(isBlockProjectHidden("b", hidden)).toBe(true);
  });

  it("is false for a task in a visible project", () => {
    expect(isBlockProjectHidden("a", hidden)).toBe(false);
  });

  it("is false for an unassigned task (null projectId)", () => {
    expect(isBlockProjectHidden(null, hidden)).toBe(false);
  });
});
