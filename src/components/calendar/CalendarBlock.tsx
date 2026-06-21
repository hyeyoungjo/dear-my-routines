"use client";

import { useDraggable } from "@dnd-kit/core";
import type { FlatNode } from "@/core/tree/types";
import { useUpdateNode } from "@/hooks/nodes";

/**
 * One scheduled task drawn on the calendar grid as an absolutely-positioned
 * block (top = start, height = duration — both pre-computed by the grid from the
 * pure `core/time` geometry, including any live drag/resize preview). Title
 * editing and the Big 3 star flow through the optimistic `useUpdateNode` hook,
 * so the screen reacts instantly and rolls back on failure (CLAUDE.md CRITICAL —
 * smooth UX, no tree/time logic re-implemented here).
 *
 * Two dnd-kit draggables register here: the block body moves the whole block
 * (`move:`), and the thin bottom edge resizes it (`resize:`). They are sibling
 * elements — not nested — so a pointer-down on the edge never also triggers the
 * move activator. The grid owns the `DndContext` and turns each drag's pixel
 * delta into a snapped time change.
 */
export function CalendarBlock({
  node,
  top,
  height,
  isDragging,
}: {
  node: FlatNode;
  top: number;
  height: number;
  isDragging: boolean;
}) {
  const updateNode = useUpdateNode();

  const move = useDraggable({
    id: `move:${node.id}`,
    data: { mode: "move", nodeId: node.id },
  });
  const resize = useDraggable({
    id: `resize:${node.id}`,
    data: { mode: "resize", nodeId: node.id },
  });

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
      ref={move.setNodeRef}
      // Stop the click from reaching the grid, which would create a new block.
      onClick={(e) => e.stopPropagation()}
      style={{ top, height }}
      className={`absolute inset-x-1 select-none overflow-hidden rounded-md border bg-accent-soft shadow-sm transition-shadow ${
        isDragging
          ? "z-10 border-accent/60 shadow-md ring-1 ring-accent/40"
          : "border-accent/30"
      }`}
    >
      {/* Body — drag anywhere here to move the block in time. */}
      <div
        {...move.listeners}
        {...move.attributes}
        className="flex h-full items-start gap-1 px-2 py-1 cursor-grab active:cursor-grabbing"
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

      {/* Bottom edge — drag to resize the block's duration. */}
      <div
        ref={resize.setNodeRef}
        {...resize.listeners}
        {...resize.attributes}
        aria-label="Resize block"
        className="absolute inset-x-0 bottom-0 h-2 cursor-ns-resize"
      />
    </div>
  );
}
