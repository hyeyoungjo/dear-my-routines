"use client";

import { useMemo } from "react";
import { buildTree } from "@/core/tree/tree";
import { PlanNode } from "@/components/PlanNode";
import { useAddNode, useNodes } from "@/hooks/nodes";

/**
 * Plan panel (ADR-004) — the morning view: lay out the day as a tree, estimate
 * time, pick the Big 3. It reads the flat node list with `useNodes` and nests
 * it via the pure `core/tree` `buildTree`; every edit flows through the step-2
 * optimistic hooks (CLAUDE.md CRITICAL — logic stays in core/hooks, UX stays
 * smooth). Drag/resize/timer are out of scope here (phase 2).
 */
export function PlanPanel() {
  const { data: nodes, isLoading, isError } = useNodes();
  const addNode = useAddNode();

  const tree = useMemo(() => buildTree(nodes ?? []), [nodes]);

  const addArea = () => {
    // Top-level node: parentId stays null, which marks an Area (ADR-009).
    addNode.mutate({
      title: "New area",
      type: "area",
      sortOrder: tree.length,
    });
  };

  return (
    <section className="flex min-h-64 flex-col rounded-lg border border-border bg-panel p-4">
      <h2 className="text-lg font-semibold tracking-tight text-foreground">Plan</h2>
      <p className="mt-1 text-xs text-muted">
        Morning — brain-dump, Big 3, estimate time
      </p>

      <div className="mt-4 flex-1">
        {isLoading ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : isError ? (
          <p className="text-sm text-red-500">Failed to load.</p>
        ) : (
          <ul className="space-y-1">
            {tree.map((node) => (
              <PlanNode key={node.id} node={node} depth={0} />
            ))}
            <li>
              <button
                type="button"
                onClick={addArea}
                className="w-full rounded-md border border-dashed border-border px-3 py-2 text-left text-sm text-muted transition-colors hover:border-accent hover:bg-accent-soft hover:text-foreground"
              >
                + Add area
              </button>
            </li>
          </ul>
        )}
      </div>
    </section>
  );
}
