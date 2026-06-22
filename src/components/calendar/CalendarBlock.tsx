"use client";

import { useRef, useState } from "react";
import { formatHours, type Span } from "@/core/time/calendar";
import type { FlatBlock } from "@/core/time/blocks";
import type { FlatNode } from "@/core/tree/types";
import { useNodes, useUpdateNode } from "@/hooks/nodes";
import { useRemoveBlock, useUpdateBlock } from "@/hooks/blocks";
import { NodeDetailModal } from "@/components/calendar/NodeDetailModal";

/** Which time-block pair a column reads/writes (ADR-004 Plan vs. Act). */
export type ColumnKind = "plan" | "action";

/** Move shifts the whole block in time; resize drags only its bottom edge. */
export type DragMode = "move" | "resize";

/**
 * One task occurrence (a `task_block`, ADR-014) laid out for a calendar column.
 * `block` is the occurrence being drawn (the drag/resize/delete target); `node`
 * is its owning task, joined in for title and project colour. `span` is its
 * effective time span; `color` is its project's colour (null = unassigned →
 * white block). `carryCount` is derived from the node's blocks (count of missed
 * occurrences) — shown as the quiet 🔁 badge (ADR-009).
 */
export type CalBlock = {
  block: FlatBlock;
  node: FlatNode;
  span: Span;
  color: string | null;
  /** Action-column ghost: drawn from the plan span, no actual recorded yet. */
  isPlaceholder?: boolean;
  /** Own action duration vs. its plan, for the overrun label. */
  comparison?: { plannedMinutes: number; actualMinutes: number };
  /** How many times the owning task has been carried (missed blocks). */
  carryCount: number;
};

/**
 * A task occurrence drawn as an absolutely-positioned block on a calendar column.
 * The block is tinted with its project colour (white when unassigned), and the
 * title **wraps inside it** — no header band. A small control row (project colour
 * → assign menu, plan-vs-actual delta, delete) sits on top and is the drag
 * handle; the bottom edge drags to resize. The schedule math lives in
 * `core/time`; the title/colour belong to the task `node`, the time span to the
 * `task_block` (ADR-014), so title edits go through `useUpdateNode` while
 * span/delete edits go through the optimistic `useUpdateBlock`/`useRemoveBlock`.
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
    blockId: string,
    column: ColumnKind,
    mode: DragMode,
    clientX: number,
    clientY: number,
  ) => void;
  /** Live horizontal cursor delta while this block is being moved, else null. */
  dragDeltaX: number | null;
}) {
  const { block: occurrence, node, color, comparison, isPlaceholder, carryCount } =
    block;
  const updateNode = useUpdateNode();
  const updateBlock = useUpdateBlock();
  const removeBlock = useRemoveBlock();

  // Projects for the assign menu (assigning sets the node's parentId → inherits
  // colour). Project membership is a property of the task, not the occurrence.
  const { data: allNodes } = useNodes();
  const projects = (allNodes ?? [])
    .filter((n) => n.type === "project")
    .sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );

  // Double-clicking the block opens its detail editor (manual reschedule). Kept
  // as light local state — the modal escapes this absolutely-positioned block via
  // its own `fixed` layer.
  const [detailOpen, setDetailOpen] = useState(false);

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
    <>
    <div
      ref={blockRef}
      // Stop the click from reaching the grid (which would create a new block);
      // on a ghost, a plain click confirms it (onConfirm guards against drags).
      onClick={(e) => {
        e.stopPropagation();
        onConfirm?.();
      }}
      // Double-click anywhere on the block body opens its detail editor. The
      // title textarea stops this (so word-select editing isn't intercepted);
      // resize/✕ keep working as their own single-click/drag handlers.
      onDoubleClick={(e) => {
        e.stopPropagation();
        setDetailOpen(true);
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
          onDragStart(occurrence.id, column, "move", e.clientX, e.clientY);
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
          // Let a double-click select a word in place instead of opening the
          // detail modal — the block's onDoubleClick stays out of the title.
          onDoubleClick={(e) => e.stopPropagation()}
          aria-label="Title"
          rows={1}
          // field-sizing:content grows the textarea to fit wrapped lines; the
          // block's own overflow-hidden crops it once it exceeds the box.
          className="min-h-0 flex-1 resize-none break-words [field-sizing:content] bg-transparent text-xs font-medium leading-tight text-foreground placeholder:font-normal placeholder:text-muted focus:outline-none"
        />

        {carryCount > 0 && (
          <span
            className="shrink-0 text-[10px] tabular-nums text-muted"
            title={`Carried over ${carryCount}×`}
          >
            🔁{carryCount}
          </span>
        )}

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

        {/* A ghost (planned, no actual yet) is confirm-only here: a body click
            copies the plan span into the actual fields (see onConfirm). The ✕
            that carries it to the next day is wired in step 4 (modal-carry-sweep),
            so a ghost shows no delete control for now. */}
        {!isPlaceholder && (
          <button
            type="button"
            onClick={() => {
              // Deleting from Action must never wipe the plan: when the block is
              // also planned, clear only its actual span (the block's Plan side
              // survives). A plan block is removed outright (this occurrence).
              if (column === "action" && occurrence.plannedStart != null) {
                updateBlock.mutate({
                  id: occurrence.id,
                  patch: { actualStart: null, actualEnd: null },
                });
              } else {
                removeBlock.mutate(occurrence.id);
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
          onDragStart(occurrence.id, column, "resize", e.clientX, e.clientY);
        }}
        aria-label="Resize block"
        className="absolute inset-x-0 bottom-0 h-2 cursor-ns-resize"
      />
    </div>
    {detailOpen && (
      <NodeDetailModal node={node} onClose={() => setDetailOpen(false)} />
    )}
    </>
  );
}
