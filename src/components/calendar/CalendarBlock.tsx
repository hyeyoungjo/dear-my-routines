"use client";

import { useDraggable } from "@dnd-kit/core";
import { formatHours, type Span } from "@/core/time/calendar";
import type { FlatNode } from "@/core/tree/types";
import { useNodes, useRemoveNode, useUpdateNode } from "@/hooks/nodes";

/** Which time-block pair a column reads/writes (ADR-004 Plan vs. Act). */
export type ColumnKind = "plan" | "action";

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
 * assign menu, Big 3, plan-vs-actual delta, delete) sits on top and is the drag
 * handle; the bottom edge drags to resize. All schedule math lives in `core/time`
 * — the block only turns the span (via `style` from the grid) into a box.
 */
export function CalendarBlock({
  block,
  column,
  style,
}: {
  block: CalBlock;
  column: ColumnKind;
  /** Absolute pixel position/size of this block within the grid column. */
  style: React.CSSProperties;
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
      ref={move.setNodeRef}
      // Stop the click from reaching the grid (which would create a new block).
      onClick={(e) => e.stopPropagation()}
      style={{ ...style, ...tintStyle }}
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
      {/* Control row — also the drag handle (grab to move the block in time). */}
      <div
        {...move.listeners}
        {...move.attributes}
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
            onMouseDown={(e) => e.stopPropagation()}
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
          onMouseDown={(e) => e.stopPropagation()}
          aria-label="Title"
          rows={1}
          className="min-h-0 flex-1 resize-none break-words bg-transparent text-xs font-medium leading-tight text-foreground placeholder:font-normal placeholder:text-muted focus:outline-none"
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

        <button
          type="button"
          onClick={() => removeNode.mutate(node.id)}
          onMouseDown={(e) => e.stopPropagation()}
          aria-label="Delete"
          title="Delete"
          className="shrink-0 text-muted opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100"
        >
          ✕
        </button>
      </div>

      {/* Bottom edge — drag to resize the block's duration. */}
      <div
        ref={resize.setNodeRef}
        {...resize.listeners}
        {...resize.attributes}
        onMouseDown={(e) => e.stopPropagation()}
        aria-label="Resize block"
        className="absolute inset-x-0 bottom-0 h-2 cursor-ns-resize"
      />
    </div>
  );
}
