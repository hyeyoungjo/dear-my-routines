"use client";

import type { FlatNode, TreeNode } from "@/core/tree/types";
import { useAddNode, useRemoveNode, useUpdateNode } from "@/hooks/nodes";

type NodeType = FlatNode["type"];

/**
 * The child type one level down the Area > Project > Task > Subtask tree
 * (ADR-009). A subtask may still nest further (arbitrary depth), so it maps to
 * another subtask. This is a UI-presentation choice — the actual tree mutation
 * lives in the `core/tree` functions the hooks reuse.
 */
const CHILD_TYPE: Record<NodeType, NodeType> = {
  area: "project",
  project: "task",
  task: "subtask",
  subtask: "subtask",
};

/** Pixels of indentation per tree depth level. */
const INDENT = 16;

/**
 * One row of the Plan tree, rendered recursively for its children (ADR-009 —
 * arbitrary depth). Every edit goes through the step-2 optimistic mutation
 * hooks, so the screen updates instantly and rolls back on failure (CLAUDE.md
 * CRITICAL — smooth UX). No tree logic is reimplemented here.
 */
export function PlanNode({ node, depth }: { node: TreeNode; depth: number }) {
  const updateNode = useUpdateNode();
  const addNode = useAddNode();
  const removeNode = useRemoveNode();

  const childType = CHILD_TYPE[node.type];

  const commitTitle = (value: string) => {
    const title = value.trim();
    if (title && title !== node.title) {
      updateNode.mutate({ id: node.id, patch: { title } });
    }
  };

  const commitEstimate = (value: string) => {
    const trimmed = value.trim();
    if (trimmed === "") {
      if (node.estimateMinutes !== null) {
        updateNode.mutate({ id: node.id, patch: { estimateMinutes: null } });
      }
      return;
    }
    const next = Math.round(Number(trimmed));
    if (Number.isNaN(next) || next < 0) return;
    if (next !== node.estimateMinutes) {
      updateNode.mutate({ id: node.id, patch: { estimateMinutes: next } });
    }
  };

  const toggleBig3 = () => {
    updateNode.mutate({ id: node.id, patch: { isBig3: !node.isBig3 } });
  };

  const addChild = () => {
    addNode.mutate({
      title: `New ${childType}`,
      type: childType,
      parentId: node.id,
      sortOrder: node.children.length,
    });
  };

  const remove = () => removeNode.mutate(node.id);

  return (
    <li>
      <div
        className="group flex items-center gap-2 rounded-md py-1 pr-1 transition-colors hover:bg-accent-soft"
        style={{ paddingLeft: depth * INDENT + 4 }}
      >
        <button
          type="button"
          onClick={toggleBig3}
          aria-label={node.isBig3 ? "Remove from Big 3" : "Mark as Big 3"}
          title="Big 3"
          className={
            node.isBig3
              ? "text-amber-500"
              : "text-muted hover:text-foreground"
          }
        >
          {node.isBig3 ? "★" : "☆"}
        </button>

        <input
          type="text"
          defaultValue={node.title}
          onBlur={(e) => commitTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
          aria-label="Title"
          className="min-w-0 flex-1 rounded border border-transparent bg-transparent px-1 py-0.5 text-sm text-foreground hover:border-border focus:border-accent focus:outline-none"
        />

        <input
          type="number"
          min={0}
          defaultValue={node.estimateMinutes ?? ""}
          onBlur={(e) => commitEstimate(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
          placeholder="min"
          aria-label="Estimate in minutes"
          className="w-16 rounded border border-transparent bg-transparent px-1 py-0.5 text-right text-xs text-muted hover:border-border focus:border-accent focus:outline-none"
        />

        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            type="button"
            onClick={addChild}
            title={`Add ${childType}`}
            aria-label={`Add ${childType}`}
            className="rounded px-1.5 py-0.5 text-xs text-muted hover:bg-accent-soft hover:text-foreground"
          >
            +
          </button>
          <button
            type="button"
            onClick={remove}
            title="Delete"
            aria-label="Delete"
            className="rounded px-1.5 py-0.5 text-xs text-muted hover:bg-red-100 hover:text-red-600"
          >
            {"✕"}
          </button>
        </div>
      </div>

      {node.children.length > 0 && (
        <ul className="space-y-1">
          {node.children.map((child) => (
            <PlanNode key={child.id} node={child} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}
