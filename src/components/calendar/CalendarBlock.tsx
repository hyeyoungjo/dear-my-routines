"use client";

import type { FlatNode } from "@/core/tree/types";
import { useUpdateNode } from "@/hooks/nodes";

/**
 * One scheduled task drawn on the calendar grid as an absolutely-positioned
 * block (top = start, height = duration — both pre-computed by the grid from the
 * pure `core/time` geometry). Title editing and the Big 3 star flow through the
 * optimistic `useUpdateNode` hook, so the screen reacts instantly and rolls back
 * on failure (CLAUDE.md CRITICAL — smooth UX, no tree/time logic re-implemented
 * here). Drag and resize are deliberately out of scope (step 2).
 */
export function CalendarBlock({
  node,
  top,
  height,
}: {
  node: FlatNode;
  top: number;
  height: number;
}) {
  const updateNode = useUpdateNode();

  const commitTitle = (value: string) => {
    const title = value.trim();
    if (title && title !== node.title) {
      updateNode.mutate({ id: node.id, patch: { title } });
    }
  };

  const toggleBig3 = () => {
    updateNode.mutate({ id: node.id, patch: { isBig3: !node.isBig3 } });
  };

  return (
    <div
      // Stop the click from reaching the grid, which would create a new block.
      onClick={(e) => e.stopPropagation()}
      style={{ top, height }}
      className="absolute inset-x-1 flex items-start gap-1 overflow-hidden rounded-md border border-accent/30 bg-accent-soft px-2 py-1 shadow-sm"
    >
      <button
        type="button"
        onClick={toggleBig3}
        aria-label={node.isBig3 ? "Remove from Big 3" : "Mark as Big 3"}
        title="Big 3"
        className={
          node.isBig3
            ? "shrink-0 text-amber-500"
            : "shrink-0 text-muted hover:text-foreground"
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
        className="min-w-0 flex-1 truncate bg-transparent text-xs font-medium text-foreground focus:outline-none"
      />
    </div>
  );
}
