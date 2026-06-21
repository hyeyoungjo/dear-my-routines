"use client";

import { useDraggable } from "@dnd-kit/core";
import { formatHours } from "@/core/time/calendar";
import type { FlatNode } from "@/core/tree/types";
import { useUpdateNode } from "@/hooks/nodes";

/** Which time-block pair a column reads/writes (ADR-004 Plan vs. Act). */
export type ColumnKind = "plan" | "action";

/**
 * One scheduled task drawn on a calendar column as an absolutely-positioned
 * block (top = start, height = duration — both pre-computed by the grid from the
 * pure `core/time` geometry, including any live drag/resize preview). The same
 * node may appear in both columns (its planned block on the left, its actual
 * block on the right), so the dnd-kit draggable ids are namespaced by `column`
 * to stay unique. Title editing and the Big 3 star flow through the optimistic
 * `useUpdateNode` hook (CLAUDE.md CRITICAL — smooth UX, no tree/time logic
 * re-implemented here); the grid owns the `DndContext` and turns each drag's
 * pixel delta into a snapped time change for this column's fields.
 *
 * - Plan blocks carry a "track" affordance that derives an actual block from the
 *   plan (copies plannedStart/End → actualStart/End on the same node), which is
 *   what lines the same task up across both columns for comparison.
 * - Action blocks that have a matching plan show the planned-vs-actual delta
 *   (e.g. `1.5h → 2.1h`), flagged when the actual overran the estimate.
 */
export function CalendarBlock({
  node,
  column,
  top,
  height,
  isDragging,
  color,
  comparison,
}: {
  node: FlatNode;
  column: ColumnKind;
  top: number;
  height: number;
  isDragging: boolean;
  color: string | null;
  comparison?: { plannedMinutes: number; actualMinutes: number };
}) {
  const updateNode = useUpdateNode();

  const move = useDraggable({
    id: `move:${column}:${node.id}`,
    data: { mode: "move", nodeId: node.id, column },
  });
  const resize = useDraggable({
    id: `resize:${column}:${node.id}`,
    data: { mode: "resize", nodeId: node.id, column },
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

  // Derive an actual block from this plan block: copy the planned span onto the
  // same node so it appears in the Action column, ready to drag to reality.
  const trackActual = () => {
    if (!node.plannedStart) return;
    updateNode.mutate({
      id: node.id,
      patch: { actualStart: node.plannedStart, actualEnd: node.plannedEnd },
    });
  };

  const overran =
    comparison != null && comparison.actualMinutes > comparison.plannedMinutes;

  return (
    <div
      ref={move.setNodeRef}
      // Stop the click from reaching the grid, which would create a new block.
      onClick={(e) => e.stopPropagation()}
      style={{ top, height }}
      className={`absolute inset-x-1 flex select-none flex-col overflow-hidden rounded-md border bg-accent-soft shadow-sm transition-shadow ${
        isDragging
          ? "z-10 border-accent/60 shadow-md ring-1 ring-accent/40"
          : "border-accent/30"
      }`}
    >
      {/* Body — drag anywhere here to move the block in time. */}
      <div
        {...move.listeners}
        {...move.attributes}
        className="flex min-h-0 flex-1 items-start gap-1 px-2 py-1 cursor-grab active:cursor-grabbing"
      >
        {color && (
          <span
            aria-hidden
            title="Project"
            className="mt-1 size-2 shrink-0 rounded-full"
            style={{ backgroundColor: color }}
          />
        )}

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

        {/* Plan-only: derive an actual block once, when none exists yet. */}
        {column === "plan" && node.actualStart == null && (
          <button
            type="button"
            onClick={trackActual}
            aria-label="Track actual time"
            title="Track actual time"
            className="shrink-0 text-muted hover:text-accent"
          >
            ▶
          </button>
        )}
      </div>

      {/* Action-only: planned-vs-actual delta, flagged when the actual overran. */}
      {comparison && (
        <p
          className={`truncate px-2 pb-0.5 text-[10px] tabular-nums ${
            overran ? "text-amber-600" : "text-muted"
          }`}
        >
          {formatHours(comparison.plannedMinutes)} →{" "}
          {formatHours(comparison.actualMinutes)}
          {overran && " ⚠"}
        </p>
      )}

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
