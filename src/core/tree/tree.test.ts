import { describe, expect, it } from "vitest";
import {
  addNode,
  ancestorOfType,
  buildTree,
  childTypeOf,
  flattenTree,
  moveNode,
  removeNode,
  reorderSiblings,
} from "./tree";
import type { FlatNode } from "./types";

/**
 * Build a FlatNode with sensible defaults so tests only specify what matters.
 * Mirrors the `nodes` schema shape (src/db/schema.ts).
 */
function makeNode(over: Partial<FlatNode> & { id: string }): FlatNode {
  return {
    userId: "user-1",
    parentId: null,
    type: "task",
    title: over.id,
    notes: null,
    links: null,
    estimateMinutes: null,
    actualMinutes: null,
    status: "pending",
    category: null,
    isBig3: false,
    plannedDate: null,
    carryCount: 0,
    sortOrder: 0,
    createdAt: new Date("2026-06-21T00:00:00Z"),
    updatedAt: new Date("2026-06-21T00:00:00Z"),
    ...over,
  };
}

/** Sample tree: area > (p1 > [t1, t2]), p2. */
function sample(): FlatNode[] {
  return [
    makeNode({ id: "area", type: "area", parentId: null, sortOrder: 0 }),
    makeNode({ id: "p1", type: "project", parentId: "area", sortOrder: 0 }),
    makeNode({ id: "p2", type: "project", parentId: "area", sortOrder: 1 }),
    makeNode({ id: "t1", type: "task", parentId: "p1", sortOrder: 0 }),
    makeNode({ id: "t2", type: "task", parentId: "p1", sortOrder: 1 }),
  ];
}

const idsOf = (nodes: FlatNode[]) => nodes.map((n) => n.id).sort();

describe("childTypeOf", () => {
  it("returns the level one step deeper", () => {
    expect(childTypeOf("area")).toBe("project");
    expect(childTypeOf("project")).toBe("task");
    expect(childTypeOf("task")).toBe("subtask");
  });

  it("keeps subtask as the deepest level", () => {
    expect(childTypeOf("subtask")).toBe("subtask");
  });
});

describe("buildTree", () => {
  it("nests children under parents and orders siblings by sortOrder", () => {
    const tree = buildTree(sample());
    expect(tree).toHaveLength(1);
    const area = tree[0];
    expect(area.id).toBe("area");
    expect(area.children.map((c) => c.id)).toEqual(["p1", "p2"]);
    const p1 = area.children[0];
    expect(p1.children.map((c) => c.id)).toEqual(["t1", "t2"]);
  });

  it("sorts siblings even when input order is shuffled", () => {
    const nodes = [
      makeNode({ id: "b", parentId: null, sortOrder: 1 }),
      makeNode({ id: "a", parentId: null, sortOrder: 0 }),
    ];
    expect(buildTree(nodes).map((n) => n.id)).toEqual(["a", "b"]);
  });

  it("returns an empty array for empty input", () => {
    expect(buildTree([])).toEqual([]);
  });

  it("handles a single node", () => {
    const tree = buildTree([makeNode({ id: "solo" })]);
    expect(tree).toHaveLength(1);
    expect(tree[0].children).toEqual([]);
  });

  it("treats orphans (missing parent) as top-level", () => {
    const tree = buildTree([makeNode({ id: "x", parentId: "ghost" })]);
    expect(tree.map((n) => n.id)).toEqual(["x"]);
  });

  it("does not mutate the input nodes", () => {
    const nodes = sample();
    const snapshot = JSON.stringify(nodes);
    buildTree(nodes);
    expect(JSON.stringify(nodes)).toBe(snapshot);
  });
});

describe("flattenTree", () => {
  it("is the inverse of buildTree (round-trip)", () => {
    const nodes = sample();
    const round = flattenTree(buildTree(nodes));
    expect(idsOf(round)).toEqual(idsOf(nodes));
    // Same count, no children field leaked, parentId preserved.
    expect(round).toHaveLength(nodes.length);
    for (const node of round) {
      expect(node).not.toHaveProperty("children");
      const original = nodes.find((n) => n.id === node.id)!;
      expect(node.parentId).toBe(original.parentId);
    }
  });

  it("round-trips an empty tree", () => {
    expect(flattenTree(buildTree([]))).toEqual([]);
  });
});

describe("addNode", () => {
  it("appends a node without mutating the input", () => {
    const nodes = sample();
    const added = addNode(nodes, makeNode({ id: "new", parentId: "p2" }));
    expect(added).toHaveLength(nodes.length + 1);
    expect(nodes).toHaveLength(5);
    expect(added.some((n) => n.id === "new")).toBe(true);
  });
});

describe("removeNode", () => {
  it("removes a node and all of its descendants", () => {
    const result = removeNode(sample(), "p1");
    expect(idsOf(result)).toEqual(["area", "p2"]);
  });

  it("removes a leaf without touching siblings", () => {
    const result = removeNode(sample(), "t1");
    expect(idsOf(result)).toEqual(["area", "p1", "p2", "t2"]);
  });

  it("is a no-op for an unknown id", () => {
    expect(idsOf(removeNode(sample(), "ghost"))).toEqual(idsOf(sample()));
  });

  it("does not mutate the input", () => {
    const nodes = sample();
    removeNode(nodes, "p1");
    expect(nodes).toHaveLength(5);
  });
});

describe("moveNode", () => {
  it("reparents a node and recomputes sibling sortOrder", () => {
    const result = moveNode(sample(), "t1", "p2", 0);
    const t1 = result.find((n) => n.id === "t1")!;
    expect(t1.parentId).toBe("p2");
    expect(t1.sortOrder).toBe(0);
    // t2 is now the only remaining child of p1, reindexed to 0.
    const t2 = result.find((n) => n.id === "t2")!;
    expect(t2.parentId).toBe("p1");
    expect(t2.sortOrder).toBe(0);
  });

  it("places the node at the requested index among new siblings", () => {
    const nodes = [
      ...sample(),
      makeNode({ id: "a", parentId: "p2", sortOrder: 0 }),
      makeNode({ id: "b", parentId: "p2", sortOrder: 1 }),
    ];
    const result = moveNode(nodes, "t1", "p2", 1);
    const p2Children = buildTree(result)[0].children.find(
      (n) => n.id === "p2",
    )!.children;
    expect(p2Children.map((n) => n.id)).toEqual(["a", "t1", "b"]);
  });

  it("can move a node to the top level (null parent)", () => {
    const result = moveNode(sample(), "p1", null, 0);
    const p1 = result.find((n) => n.id === "p1")!;
    expect(p1.parentId).toBeNull();
  });

  it("refuses to move a node into itself (cycle) and returns input unchanged", () => {
    const nodes = sample();
    const result = moveNode(nodes, "p1", "p1", 0);
    expect(result).toBe(nodes);
  });

  it("refuses to move a node under its own descendant", () => {
    const nodes = sample();
    const result = moveNode(nodes, "p1", "t1", 0);
    expect(result).toBe(nodes);
  });

  it("is a no-op for an unknown id", () => {
    const nodes = sample();
    expect(moveNode(nodes, "ghost", "p2", 0)).toBe(nodes);
  });
});

describe("reorderSiblings", () => {
  it("assigns sortOrder 0,1,2,… in the given order", () => {
    const result = reorderSiblings(sample(), "p1", ["t2", "t1"]);
    const t2 = result.find((n) => n.id === "t2")!;
    const t1 = result.find((n) => n.id === "t1")!;
    expect(t2.sortOrder).toBe(0);
    expect(t1.sortOrder).toBe(1);
  });

  it("ignores ids that are not children of the parent", () => {
    const result = reorderSiblings(sample(), "p1", ["t2", "p2", "t1"]);
    expect(result.find((n) => n.id === "t2")!.sortOrder).toBe(0);
    expect(result.find((n) => n.id === "t1")!.sortOrder).toBe(1);
    // p2 keeps its own sortOrder; it is not a child of p1.
    expect(result.find((n) => n.id === "p2")!.sortOrder).toBe(1);
  });

  it("does not mutate the input", () => {
    const nodes = sample();
    reorderSiblings(nodes, "p1", ["t2", "t1"]);
    expect(nodes.find((n) => n.id === "t1")!.sortOrder).toBe(0);
  });
});

describe("ancestorOfType", () => {
  // area > project > task > subtask, one straight chain.
  const nodes = [
    makeNode({ id: "area", type: "area" }),
    makeNode({ id: "proj", type: "project", parentId: "area" }),
    makeNode({ id: "task", type: "task", parentId: "proj" }),
    makeNode({ id: "sub", type: "subtask", parentId: "task" }),
  ];

  it("finds the nearest ancestor of a given type", () => {
    expect(ancestorOfType(nodes, "sub", "project")?.id).toBe("proj");
    expect(ancestorOfType(nodes, "task", "area")?.id).toBe("area");
  });

  it("returns null when no such ancestor exists", () => {
    expect(ancestorOfType(nodes, "area", "project")).toBeNull();
    expect(ancestorOfType(nodes, "missing", "area")).toBeNull();
  });
});
