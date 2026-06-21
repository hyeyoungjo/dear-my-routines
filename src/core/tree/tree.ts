import type { FlatNode, TreeNode } from "./types";

/**
 * Pure tree operations over the flat `nodes` array (ADR-009).
 *
 * Every function is pure: inputs are never mutated, a new array/tree is always
 * returned. This keeps the logic trivially unit-testable and reusable from a
 * future mobile client (CLAUDE.md CRITICAL — business logic lives in `core/`).
 */

/** Compare siblings by `sortOrder`, falling back to `id` for a stable order. */
function bySortOrder(a: FlatNode, b: FlatNode): number {
  if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * Build a nested tree from a flat array, ordering siblings by `sortOrder`.
 * Top-level nodes are those with `parentId == null`. Orphans (a `parentId`
 * pointing at a node not present in the input) are treated as top-level so no
 * data is silently dropped.
 */
export function buildTree(nodes: FlatNode[]): TreeNode[] {
  const byId = new Map<string, TreeNode>();
  for (const node of nodes) {
    byId.set(node.id, { ...node, children: [] });
  }

  const roots: TreeNode[] = [];
  for (const node of nodes) {
    const treeNode = byId.get(node.id)!;
    const parent = node.parentId != null ? byId.get(node.parentId) : undefined;
    if (parent) {
      parent.children.push(treeNode);
    } else {
      roots.push(treeNode);
    }
  }

  const sortRecursive = (siblings: TreeNode[]) => {
    siblings.sort(bySortOrder);
    for (const child of siblings) sortRecursive(child.children);
  };
  sortRecursive(roots);

  return roots;
}

/**
 * Flatten a nested tree back into a flat array (inverse of {@link buildTree}).
 * The `children` field is stripped so each element is a plain `FlatNode`.
 */
export function flattenTree(tree: TreeNode[]): FlatNode[] {
  const out: FlatNode[] = [];
  const walk = (nodes: TreeNode[]) => {
    for (const node of nodes) {
      const { children, ...flat } = node;
      out.push(flat);
      walk(children);
    }
  };
  walk(tree);
  return out;
}

/** Append a node. Returns a new array; inputs are untouched. */
export function addNode(nodes: FlatNode[], newNode: FlatNode): FlatNode[] {
  return [...nodes, newNode];
}

/** Collect `id` plus every descendant id, recursively. */
function descendantIds(nodes: FlatNode[], id: string): Set<string> {
  const childrenOf = new Map<string, string[]>();
  for (const node of nodes) {
    if (node.parentId == null) continue;
    const list = childrenOf.get(node.parentId) ?? [];
    list.push(node.id);
    childrenOf.set(node.parentId, list);
  }

  const collected = new Set<string>();
  const visit = (current: string) => {
    if (collected.has(current)) return;
    collected.add(current);
    for (const child of childrenOf.get(current) ?? []) visit(child);
  };
  visit(id);
  return collected;
}

/** Remove a node and all of its descendants. Returns a new array. */
export function removeNode(nodes: FlatNode[], id: string): FlatNode[] {
  const toRemove = descendantIds(nodes, id);
  return nodes.filter((node) => !toRemove.has(node.id));
}

/**
 * Move a node under a new parent at a given index among its new siblings,
 * recomputing `sortOrder` (0, 1, 2, …) for both the destination group and the
 * source group left behind, so neither group keeps a gap.
 *
 * Cycles are forbidden: if `newParentId` is the node itself or one of its
 * descendants, the original array is returned unchanged. The same is returned
 * if the node does not exist.
 */
export function moveNode(
  nodes: FlatNode[],
  id: string,
  newParentId: string | null,
  newIndex: number,
): FlatNode[] {
  const moving = nodes.find((node) => node.id === id);
  if (!moving) return nodes;

  // Reject moving a node into its own subtree (would create a cycle).
  if (newParentId != null && descendantIds(nodes, id).has(newParentId)) {
    return nodes;
  }

  const newOrder = new Map<string, number>();

  // Compact the source group (old siblings, minus the moved node).
  if (moving.parentId !== newParentId) {
    nodes
      .filter((node) => node.parentId === moving.parentId && node.id !== id)
      .sort(bySortOrder)
      .forEach((node, index) => newOrder.set(node.id, index));
  }

  // Insert the moved node into the destination group at `newIndex`.
  const siblings = nodes
    .filter((node) => node.parentId === newParentId && node.id !== id)
    .sort(bySortOrder);
  const clampedIndex = Math.max(0, Math.min(newIndex, siblings.length));
  [
    ...siblings.slice(0, clampedIndex),
    moving,
    ...siblings.slice(clampedIndex),
  ].forEach((node, index) => newOrder.set(node.id, index));

  return nodes.map((node) => {
    if (node.id === id) {
      return { ...node, parentId: newParentId, sortOrder: newOrder.get(id)! };
    }
    if (newOrder.has(node.id)) {
      return { ...node, sortOrder: newOrder.get(node.id)! };
    }
    return node;
  });
}

/**
 * Reorder the direct children of `parentId` to match `orderedIds`, assigning
 * `sortOrder` 0, 1, 2, … in that order. Ids in `orderedIds` that are not
 * children of `parentId` are ignored; children omitted from `orderedIds` keep
 * their existing `sortOrder`. Returns a new array.
 */
export function reorderSiblings(
  nodes: FlatNode[],
  parentId: string | null,
  orderedIds: string[],
): FlatNode[] {
  const childIds = new Set(
    nodes.filter((node) => node.parentId === parentId).map((node) => node.id),
  );
  const newOrder = new Map<string, number>();
  orderedIds
    .filter((nodeId) => childIds.has(nodeId))
    .forEach((nodeId, index) => newOrder.set(nodeId, index));

  return nodes.map((node) =>
    newOrder.has(node.id)
      ? { ...node, sortOrder: newOrder.get(node.id)! }
      : node,
  );
}
