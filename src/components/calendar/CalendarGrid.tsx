"use client";

import { useRef, useState } from "react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragMoveEvent,
} from "@dnd-kit/core";
import {
  GRID_TOTAL_MINUTES,
  addMinutes,
  blockTopMinutes,
  durationMinutes,
  gridSlots,
  moveBlock,
  resizeBlockEnd,
  slotDate,
  snapMinutes,
  snapToSlot,
  type Span,
} from "@/core/time/calendar";
import { ancestorOfType } from "@/core/tree/tree";
import type { FlatNode } from "@/core/tree/types";
import type { NewNode } from "@/db/schema";
import { projectColor } from "@/lib/projectColor";
import {
  CalendarBlock,
  type ColumnKind,
} from "@/components/calendar/CalendarBlock";
import { useAddNode, useNodes, useUpdateNode } from "@/hooks/nodes";

/** Pixel height of one hour row; the whole grid scales off this. */
const SLOT_HEIGHT = 48;
const PX_PER_MINUTE = SLOT_HEIGHT / 60;
/** Default length of a freshly-created block (one hour). */
const DEFAULT_BLOCK_MINUTES = 60;

type DragMode = "move" | "resize";
type DragData = { mode: DragMode; nodeId: string; column: ColumnKind };
/** Live, snapped preview of the block currently being dragged or resized. */
type DragPreview = {
  column: ColumnKind;
  nodeId: string;
  mode: DragMode;
  deltaMinutes: number;
};

/**
 * Read a node's span for a column from the matching field pair (planned vs.
 * actual), falling back to a default length when the end is unset. Returns null
 * when the column's start is unset — i.e. the block does not belong here.
 */
function readSpan(node: FlatNode, kind: ColumnKind): Span | null {
  const startVal = kind === "plan" ? node.plannedStart : node.actualStart;
  const endVal = kind === "plan" ? node.plannedEnd : node.actualEnd;
  if (startVal == null) return null;
  const start = new Date(startVal);
  const end = endVal ? new Date(endVal) : addMinutes(start, DEFAULT_BLOCK_MINUTES);
  return { start, end };
}

/** Patch that writes a whole span (move) into the column's field pair. */
function movePatch(kind: ColumnKind, span: Span): Partial<NewNode> {
  return kind === "plan"
    ? { plannedStart: span.start, plannedEnd: span.end }
    : { actualStart: span.start, actualEnd: span.end };
}

/** Patch that writes only the end (resize) into the column's field pair. */
function resizePatch(kind: ColumnKind, span: Span): Partial<NewNode> {
  return kind === "plan" ? { plannedEnd: span.end } : { actualEnd: span.end };
}

/**
 * Two-column day view (07:00 → 02:00, PRD "예상 vs. 실제"): a Plan column
 * (`plannedStart/End`) on the left and an Action column (`actualStart/End`) on
 * the right, sharing one time axis down the middle so the same wall-clock time
 * sits at the same height in both. Clicking an empty slot in either column
 * creates a one-hour task there (optimistically, via `useAddNode`); a plan block
 * can also derive an actual block onto the same node, lining the task up across
 * both columns so its estimate-vs-actual delta is visible.
 *
 * Blocks can be dragged to move and edge-dragged to resize (one shared dnd-kit
 * context; draggable ids are namespaced by column). The pixel delta is converted
 * to a snapped minute delta, previewed live, and committed on release through the
 * optimistic `useUpdateNode` hook into the column's own field pair, so the change
 * shows instantly and rolls back on failure (CLAUDE.md CRITICAL). All schedule
 * math comes from the pure `core/time` helpers — this component only turns
 * minutes into pixels and back, and picks which field pair a column owns.
 */
export function CalendarGrid() {
  const { data: nodes, isLoading, isError } = useNodes();
  const addNode = useAddNode();
  const updateNode = useUpdateNode();
  const planBodyRef = useRef<HTMLDivElement>(null);
  const actionBodyRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<DragPreview | null>(null);

  // A small movement threshold so a plain click (edit title, toggle Big 3,
  // create on empty slot) never starts a drag.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  const slots = gridSlots();
  const bodyHeight = GRID_TOTAL_MINUTES * PX_PER_MINUTE;
  const all = nodes ?? [];

  const createAt = (offsetMinutes: number, kind: ColumnKind) => {
    const start = slotDate(new Date(), offsetMinutes);
    const end = slotDate(new Date(), offsetMinutes + DEFAULT_BLOCK_MINUTES);
    addNode.mutate({
      title: "New task",
      type: "task",
      ...(kind === "plan"
        ? { plannedStart: start, plannedEnd: end }
        : { actualStart: start, actualEnd: end }),
    });
  };

  const handleBodyClick = (
    e: React.MouseEvent<HTMLDivElement>,
    kind: ColumnKind,
  ) => {
    const body = (kind === "plan" ? planBodyRef : actionBodyRef).current;
    if (!body) return;
    const y = e.clientY - body.getBoundingClientRect().top;
    createAt(snapToSlot(y / PX_PER_MINUTE), kind);
  };

  const handleDragMove = (e: DragMoveEvent) => {
    const data = e.active.data.current as DragData | undefined;
    if (!data) return;
    setDrag({
      column: data.column,
      nodeId: data.nodeId,
      mode: data.mode,
      deltaMinutes: snapMinutes(e.delta.y / PX_PER_MINUTE),
    });
  };

  const handleDragEnd = (e: DragEndEvent) => {
    setDrag(null);
    const data = e.active.data.current as DragData | undefined;
    if (!data) return;
    const node = all.find((n) => n.id === data.nodeId);
    if (!node) return;
    const base = readSpan(node, data.column);
    if (!base) return;
    const deltaMinutes = snapMinutes(e.delta.y / PX_PER_MINUTE);
    if (deltaMinutes === 0) return;

    const span =
      data.mode === "move"
        ? moveBlock(base.start, base.end, deltaMinutes)
        : resizeBlockEnd(base.start, base.end, deltaMinutes);
    const patch =
      data.mode === "move"
        ? movePatch(data.column, span)
        : resizePatch(data.column, span);
    updateNode.mutate({ id: node.id, patch });
  };

  /** Render one column's grid body: hour lines, click-to-create, and blocks. */
  const renderColumn = (kind: ColumnKind) => (
    <div
      ref={kind === "plan" ? planBodyRef : actionBodyRef}
      onClick={(e) => handleBodyClick(e, kind)}
      className="relative flex-1 cursor-pointer border-l border-border"
      style={{ height: bodyHeight }}
    >
      {slots.slice(0, -1).map((slot) => (
        <div
          key={slot.offsetMinutes}
          className="absolute inset-x-0 border-t border-border/70"
          style={{ top: slot.offsetMinutes * PX_PER_MINUTE }}
        />
      ))}

      {all.map((node) => {
        const base = readSpan(node, kind);
        if (!base) return null;

        // Apply the live drag/resize preview with the exact same pure math the
        // commit uses, so what you see is what you get.
        const span =
          drag?.column === kind && drag.nodeId === node.id
            ? drag.mode === "move"
              ? moveBlock(base.start, base.end, drag.deltaMinutes)
              : resizeBlockEnd(base.start, base.end, drag.deltaMinutes)
            : base;

        const mins = durationMinutes(span.start, span.end);
        const project = ancestorOfType(all, node.id, "project");
        const planSpan = kind === "action" ? readSpan(node, "plan") : null;

        return (
          <CalendarBlock
            key={node.id}
            node={node}
            column={kind}
            top={blockTopMinutes(span.start) * PX_PER_MINUTE}
            height={Math.max(mins, 30) * PX_PER_MINUTE}
            isDragging={drag?.column === kind && drag.nodeId === node.id}
            color={projectColor(project?.id ?? null)}
            comparison={
              planSpan
                ? {
                    plannedMinutes: durationMinutes(planSpan.start, planSpan.end),
                    actualMinutes: mins,
                  }
                : undefined
            }
          />
        );
      })}
    </div>
  );

  return (
    <section className="flex min-h-0 flex-col rounded-xl border border-border bg-panel p-5">
      {/* Column headers aligned to the body layout below. */}
      <div className="mb-4 flex items-baseline">
        <div className="flex-1">
          <h2 className="text-base font-semibold tracking-tight text-foreground">
            Plan
          </h2>
          <p className="mt-0.5 text-xs text-muted">
            Estimated — click an empty slot to add
          </p>
        </div>
        <div className="w-14 shrink-0" aria-hidden />
        <div className="flex-1 text-right">
          <h2 className="text-base font-semibold tracking-tight text-foreground">
            Action
          </h2>
          <p className="mt-0.5 text-xs text-muted">
            Actual — ▶ a plan block, or click to add
          </p>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : isError ? (
        <p className="text-sm text-red-500">Failed to load.</p>
      ) : (
        <DndContext
          sensors={sensors}
          onDragMove={handleDragMove}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setDrag(null)}
        >
          <div className="flex">
            {/* Left: Plan column */}
            {renderColumn("plan")}

            {/* Center: shared time axis */}
            <div
              className="relative w-14 shrink-0"
              style={{ height: bodyHeight }}
            >
              {slots.map((slot) => (
                <span
                  key={slot.offsetMinutes}
                  className="absolute inset-x-0 -translate-y-1/2 text-center text-[10px] tabular-nums text-muted"
                  style={{ top: slot.offsetMinutes * PX_PER_MINUTE }}
                >
                  {slot.label}
                </span>
              ))}
            </div>

            {/* Right: Action column */}
            {renderColumn("action")}
          </div>
        </DndContext>
      )}
    </section>
  );
}
