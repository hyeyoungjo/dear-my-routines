"use client";

import { useDraggable } from "@dnd-kit/core";
import {
  blockPixelHeight,
  childOffsetPx,
  formatHours,
  type Span,
} from "@/core/time/calendar";
import type { FlatNode } from "@/core/tree/types";
import { useRemoveNode, useUpdateNode } from "@/hooks/nodes";

/** Which time-block pair a column reads/writes (ADR-004 Plan vs. Act). */
export type ColumnKind = "plan" | "action";

/**
 * One node laid out for the calendar (frame-in-frame, ADR-009). `span` is the
 * node's *effective* span — its own time grown to wrap its children
 * (`fitParentToChildren`) — so a parent whose subtasks overflow stretches to
 * contain them. `children` are the same shape, nested to arbitrary depth. The
 * grid builds this tree (all schedule math stays in `core/time`); the block only
 * turns spans into positions.
 */
export type CalBlock = {
  node: FlatNode;
  span: Span;
  color: string | null;
  /** Action-column ghost: drawn from the plan span, no actual recorded yet. */
  isPlaceholder?: boolean;
  /** Own (un-fitted) action duration vs. its plan, for the overrun label. */
  comparison?: { plannedMinutes: number; actualMinutes: number };
  children: CalBlock[];
};

/**
 * One scheduled task drawn on a calendar column as an absolutely-positioned
 * block, rendering its subtasks **recursively inside itself** as inset, time-
 * positioned child blocks (frame-in-frame, arbitrary depth — ADR-009). Every
 * block — top-level or nested — is positioned and sized in **pixels** off the
 * shared `pxPerMinute` scale and the fixed `headerPx` title row: a child sits
 * just below its parent's header (`childOffsetPx`) and is as tall as its own
 * footprint (`blockPixelHeight`), so the parent always wraps title + children
 * with nothing clipped, at any depth. Both drag to move and edge-drag to resize.
 * Deeper levels are indented and lightly shaded so the nesting reads at a glance.
 *
 * Title editing, the Big 3 star, deriving an actual block from a plan, and
 * adding a subtask all flow through optimistic hooks (CLAUDE.md CRITICAL —
 * smooth UX, no tree/time logic re-implemented here).
 *
 * - Plan blocks carry a "track" affordance that derives an actual block from the
 *   plan (copies plannedStart/End → actualStart/End on the same node), lining the
 *   same task up across both columns for comparison.
 * - Action blocks that have a matching plan show the planned-vs-actual delta
 *   (e.g. `1.5h → 2.1h`), flagged when the actual overran the estimate.
 */
export function CalendarBlock({
  block,
  column,
  depth,
  style,
  pxPerMinute,
  headerPx,
  onAddSubtask,
}: {
  block: CalBlock;
  column: ColumnKind;
  depth: number;
  /** Absolute pixel position/size of this block within its parent (or the grid). */
  style: React.CSSProperties;
  /** Shared minute→pixel scale; constant through the nesting (set by the grid). */
  pxPerMinute: number;
  /** Fixed pixel height of the title row; children sit below it. */
  headerPx: number;
  /** Create a child node under `parent` in this column (optimistic, owned by grid). */
  onAddSubtask: (parent: FlatNode) => void;
}) {
  const { node, span, color, comparison, children, isPlaceholder } = block;
  const updateNode = useUpdateNode();
  const removeNode = useRemoveNode();

  // Every block drags to move and edge-drags to resize, at any nesting depth
  // (ADR-009 frame-in-frame). dnd-kit ids are namespaced by column + node id so
  // depths and columns never collide. The grid previews movement by re-rendering
  // the block at its snapped span, so no CSS transform is applied here.
  const move = useDraggable({
    id: `move:${column}:${node.id}`,
    data: { mode: "move", nodeId: node.id, column },
  });
  const resize = useDraggable({
    id: `resize:${column}:${node.id}`,
    data: { mode: "resize", nodeId: node.id, column },
  });
  const isDragging = move.isDragging || resize.isDragging;

  const commitTitle = (value: string) => {
    const title = value.trim();
    if (title && title !== node.title) {
      updateNode.mutate({ id: node.id, patch: { title } });
    }
  };

  const toggleBig3 = () => {
    updateNode.mutate({ id: node.id, patch: { isBig3: !node.isBig3 } });
  };

  const overran =
    comparison != null && comparison.actualMinutes > comparison.plannedMinutes;

  // Top-level blocks span the full column width; nested ones are inset (left
  // padding + a hair narrower) and lightly faded so frame-in-frame is visible.
  const positionClass = depth === 0 ? "inset-x-1" : "left-3 right-1";
  const toneClass =
    depth === 0 ? "bg-accent-soft" : depth === 1 ? "bg-accent-soft/70" : "bg-accent-soft/50";

  return (
    <div
      ref={move.setNodeRef}
      // Stop the click from reaching the grid, which would create a new block.
      onClick={(e) => e.stopPropagation()}
      style={style}
      className={`absolute ${positionClass} flex min-h-[1.75rem] select-none flex-col overflow-hidden rounded-md border ${toneClass} shadow-sm transition-shadow ${
        isDragging
          ? "z-10 border-accent/60 shadow-md ring-1 ring-accent/40"
          : "border-accent/30"
      } ${isPlaceholder ? "border-dashed opacity-60" : ""}`}
    >
      {/* Title header — fixed height (headerPx) so it never eats into the time
          span below it; drag anywhere here to move the block in time. */}
      <div
        {...move.listeners}
        {...move.attributes}
        style={{ height: headerPx }}
        className="relative z-10 flex shrink-0 cursor-grab items-center gap-1 px-2 active:cursor-grabbing"
      >
        {color && (
          <span
            aria-hidden
            title="Project"
            className="size-2 shrink-0 rounded-full"
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
          placeholder={
            node.type === "area"
              ? "New area"
              : node.type === "project"
                ? "New project"
                : node.type === "task"
                  ? "New task"
                  : "New subtask"
          }
          className="min-w-0 flex-1 truncate bg-transparent text-xs font-medium text-foreground placeholder:font-normal placeholder:text-muted focus:outline-none"
        />

        {/* Action-only: planned-vs-actual delta, flagged when it overran. Kept
            inside the fixed-height header so it never overlaps the children. */}
        {comparison && (
          <span
            className={`shrink-0 text-[10px] tabular-nums ${
              overran ? "text-amber-600" : "text-muted"
            }`}
          >
            {formatHours(comparison.plannedMinutes)} →{" "}
            {formatHours(comparison.actualMinutes)}
            {overran && " ⚠"}
          </span>
        )}

        {/* Add a subtask nested inside this block (one level deeper). */}
        <button
          type="button"
          onClick={() => onAddSubtask(node)}
          aria-label="Add subtask"
          title="Add subtask"
          className="shrink-0 text-muted hover:text-accent"
        >
          ＋
        </button>

        {/* Delete this node (its subtasks cascade via the API). */}
        <button
          type="button"
          onClick={() => removeNode.mutate(node.id)}
          aria-label="Delete"
          title="Delete"
          className="shrink-0 text-muted hover:text-red-500"
        >
          ✕
        </button>
      </div>

      {/* Nested subtasks, positioned in pixels off this block's own top edge:
          each sits just below the header (childOffsetPx) and is as tall as its
          full footprint (blockPixelHeight), so nothing is clipped at any depth
          (ADR-009). The layer spans the whole block; children start at headerPx
          and never cover the title row above. */}
      <div className="absolute inset-0">
        {children.map((child) => (
          <CalendarBlock
            key={child.node.id}
            block={child}
            column={column}
            depth={depth + 1}
            pxPerMinute={pxPerMinute}
            headerPx={headerPx}
            style={{
              // Inset a few px top/bottom so subtasks breathe inside the parent
              // instead of touching its header and bottom edge.
              top:
                childOffsetPx(span.start, child.span.start, pxPerMinute, headerPx) +
                6,
              height: Math.max(
                blockPixelHeight(child, pxPerMinute, headerPx) - 12,
                24,
              ),
            }}
            onAddSubtask={onAddSubtask}
          />
        ))}
      </div>

      {/* Bottom edge — drag to resize the block's duration (any depth). */}
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
