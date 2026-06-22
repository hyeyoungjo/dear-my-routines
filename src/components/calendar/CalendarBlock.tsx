"use client";

import { useRef } from "react";
import { formatHours, type Span } from "@/core/time/calendar";
import type { FlatNode } from "@/core/tree/types";
import { useNodes, useRemoveNode, useUpdateNode } from "@/hooks/nodes";

/** Which time-block pair a column reads/writes (ADR-004 Plan vs. Act). */
export type ColumnKind = "plan" | "action";

/** Move shifts the whole block in time; resize drags only its bottom edge. */
export type DragMode = "move" | "resize";

/**
 * One task laid out for a calendar column. `span` is its effective time span;
 * `color` is its project's colour (null = unassigned → white block). `children`
 * is retained on the type but no longer rendered (Project > Task only).
 */
export type CalBlock = {
  node: FlatNode;
  span: Span;
  color: string | null;
  /** Action-column ghost: drawn from the plan span, no actual recorded yet. */
  isPlaceholder?: boolean;
  /** Own action duration vs. its plan, for the overrun label. */
  comparison?: { plannedMinutes: number; actualMinutes: number };
  children: CalBlock[];
};

/**
 * A task drawn as an absolutely-positioned block on a calendar column. The block
 * is tinted with its project colour (white when unassigned), and the title
 * **wraps inside it** — no header band. A small control row (project colour →
 * assign menu, plan-vs-actual delta, delete) sits on top and is the drag handle;
 * the bottom edge drags to resize. All schedule math lives in `core/time`.
 *
 * Dragging is plain pointer events (no dnd-kit): pressing the control row starts
 * a move, the bottom edge starts a resize, and the grid tracks the pointer on
 * `window` (so the layout can re-flow freely as overlaps change — no library
 * fighting our re-render). While moving, the grid re-positions this block
 * vertically via its `style` (snapped time) and we follow the cursor
 * horizontally via `dragDeltaX` so the column choice reads live before drop.
 */
export function CalendarBlock({
  block,
  column,
  style,
  onConfirm,
  onDragStart,
  dragDeltaX,
}: {
  block: CalBlock;
  column: ColumnKind;
  /** Absolute pixel position/size of this block within the grid column. */
  style: React.CSSProperties;
  /** Click-to-confirm for a ghost (undefined for real blocks). */
  onConfirm?: () => void;
  /** Begin a pointer drag (move/resize) — the grid owns the drag state. */
  onDragStart: (
    nodeId: string,
    column: ColumnKind,
    mode: DragMode,
    clientX: number,
    clientY: number,
  ) => void;
  /** Live horizontal cursor delta while this block is being moved, else null. */
  dragDeltaX: number | null;
}) {
  const { node, color, comparison, isPlaceholder } = block;
  const updateNode = useUpdateNode();
  const removeNode = useRemoveNode();

  // Projects for the assign menu (assigning sets parentId → inherits colour).
  const { data: allNodes } = useNodes();
  const projects = (allNodes ?? [])
    .filter((n) => n.type === "project")
    .sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );

  const isDragging = dragDeltaX !== null;
  // Clamp the horizontal drag to the block's own column so it stops at the edge
  // (like a wall) instead of sliding into the other column.
  const blockRef = useRef<HTMLDivElement>(null);
  let clampedDeltaX = dragDeltaX ?? 0;
  if (isDragging) {
    const el = blockRef.current;
    if (el) {
      const parentW =
        (el.offsetParent as HTMLElement | null)?.clientWidth ?? el.offsetWidth;
      clampedDeltaX = Math.max(
        -el.offsetLeft,
        Math.min(clampedDeltaX, parentW - el.offsetLeft - el.offsetWidth),
      );
    }
  }

  const commitTitle = (value: string) => {
    const title = value.trim();
    if (title !== node.title) updateNode.mutate({ id: node.id, patch: { title } });
  };
  const overran =
    comparison != null && comparison.actualMinutes > comparison.plannedMinutes;

  // Tinted with the project colour; white when no project is assigned.
  const tintStyle = color
    ? { backgroundColor: `${color}26`, borderColor: `${color}66` }
    : undefined;

  return (
    <div
      ref={blockRef}
      // Stop the click from reaching the grid (which would create a new block);
      // on a ghost, a plain click confirms it (onConfirm guards against drags).
      onClick={(e) => {
        e.stopPropagation();
        onConfirm?.();
      }}
      style={{
        ...style,
        ...tintStyle,
        // Vertical movement comes from the grid's `style` (snapped time); we
        // follow the cursor horizontally here, clamped to the column edges.
        transform: isDragging ? `translateX(${clampedDeltaX}px)` : undefined,
      }}
      className={`group absolute flex select-none flex-col gap-0.5 overflow-hidden rounded-md border p-1 shadow-sm transition-shadow ${
        color ? "" : "border-accent/50 bg-accent-soft"
      } ${
        isDragging
          ? "z-10 border-accent/60 shadow-md ring-1 ring-accent/40"
          : color
            ? ""
            : "border-accent/50"
      } ${isPlaceholder ? "border-dashed opacity-60" : ""}`}
    >
      {/* Control row — also the drag handle (press and drag to move in time). */}
      <div
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          e.preventDefault();
          onDragStart(node.id, column, "move", e.clientX, e.clientY);
        }}
        className="flex flex-1 cursor-grab items-start gap-1 active:cursor-grabbing"
      >
        {/* Project colour swatch with a transparent native picker → assign menu. */}
        <span className="relative flex size-3 shrink-0 items-center justify-center">
          <span
            className="size-2 rounded-full"
            style={{
              backgroundColor: color ?? "transparent",
              boxShadow: color ? undefined : "inset 0 0 0 1px var(--border)",
            }}
          />
          <select
            value={node.parentId ?? ""}
            onChange={(e) =>
              updateNode.mutate({
                id: node.id,
                patch: { parentId: e.target.value || null },
              })
            }
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            aria-label="Assign project"
            title="Assign project"
            className="absolute inset-0 cursor-pointer opacity-0"
          >
            <option value="">No project</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title || "Project"}
              </option>
            ))}
          </select>
        </span>

        {/* Title — starts on the same row as the colour swatch; wraps as it grows. */}
        <textarea
          defaultValue={node.title}
          placeholder="New task"
          onBlur={(e) => commitTitle(e.target.value)}
          onPointerDown={(e) => e.stopPropagation()}
          aria-label="Title"
          rows={1}
          className={`min-h-0 flex-1 resize-none break-words bg-transparent text-xs font-medium leading-tight placeholder:font-normal placeholder:text-muted focus:outline-none ${
            node.status === "dropped" ? "text-muted line-through" : "text-foreground"
          }`}
        />

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

        {isPlaceholder ? (
          // A ghost (planned, no actual yet): a body click confirms it (see
          // onConfirm); ✕ marks it not done (status → dropped — it leaves the
          // Action column and shows struck through in Plan, the plan kept).
          <button
            type="button"
            onClick={() =>
              updateNode.mutate({ id: node.id, patch: { status: "dropped" } })
            }
            onPointerDown={(e) => e.stopPropagation()}
            aria-label="Didn't do it"
            title="Didn't do it"
            className="shrink-0 text-muted opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100"
          >
            ✕
          </button>
        ) : node.status === "dropped" ? (
          // A dropped task lingers struck-through in Plan; ↺ brings it back.
          <button
            type="button"
            onClick={() =>
              updateNode.mutate({ id: node.id, patch: { status: "pending" } })
            }
            onPointerDown={(e) => e.stopPropagation()}
            aria-label="Restore — bring it back"
            title="Bring it back"
            className="shrink-0 text-muted opacity-0 transition-opacity hover:text-emerald-500 group-hover:opacity-100"
          >
            ↺
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              // Deleting from Action must never wipe the plan: when the task is
              // also planned, clear only its actual span (the node and its Plan
              // block survive). A plan block — or an action-only task with no
              // plan to fall back to — is removed outright.
              if (column === "action" && node.plannedStart != null) {
                updateNode.mutate({
                  id: node.id,
                  patch: { actualStart: null, actualEnd: null },
                });
              } else {
                removeNode.mutate(node.id);
              }
            }}
            onPointerDown={(e) => e.stopPropagation()}
            aria-label={column === "action" ? "Clear actual" : "Delete"}
            title={column === "action" ? "Clear actual" : "Delete"}
            className="shrink-0 text-muted opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100"
          >
            ✕
          </button>
        )}
      </div>

      {/* Bottom edge — drag to resize the block's duration. */}
      <div
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          e.preventDefault();
          e.stopPropagation();
          onDragStart(node.id, column, "resize", e.clientX, e.clientY);
        }}
        aria-label="Resize block"
        className="absolute inset-x-0 bottom-0 h-2 cursor-ns-resize"
      />
    </div>
  );
}
