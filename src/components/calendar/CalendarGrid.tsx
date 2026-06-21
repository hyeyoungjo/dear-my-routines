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
} from "@/core/time/calendar";
import { CalendarBlock } from "@/components/calendar/CalendarBlock";
import { useAddNode, useNodes, useUpdateNode } from "@/hooks/nodes";

/** Pixel height of one hour row; the whole grid scales off this. */
const SLOT_HEIGHT = 48;
const PX_PER_MINUTE = SLOT_HEIGHT / 60;
/** Default length of a freshly-created block (one hour). */
const DEFAULT_BLOCK_MINUTES = 60;

type DragMode = "move" | "resize";
type DragData = { mode: DragMode; nodeId: string };
/** Live, snapped preview of the block currently being dragged or resized. */
type DragPreview = { nodeId: string; mode: DragMode; deltaMinutes: number };

/**
 * Google-Calendar-style day grid (07:00 → 02:00, PRD "하루를 한눈에"). Tasks with
 * a `plannedStart` are drawn as time-positioned blocks; clicking an empty slot
 * creates a one-hour task there (optimistically, via `useAddNode`).
 *
 * Blocks can be dragged to move and edge-dragged to resize (dnd-kit). The drag's
 * pixel delta is converted to a snapped minute delta and previewed live while
 * dragging; on release it commits through the optimistic `useUpdateNode` hook so
 * the change shows instantly and rolls back on failure (CLAUDE.md CRITICAL). All
 * schedule math comes from the pure `core/time` helpers — this component only
 * turns minutes into pixels and back. The Act (actual) column is a later step.
 */
export function CalendarGrid() {
  const { data: nodes, isLoading, isError } = useNodes();
  const addNode = useAddNode();
  const updateNode = useUpdateNode();
  const bodyRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<DragPreview | null>(null);

  // A small movement threshold so a plain click (edit title, toggle Big 3,
  // create on empty slot) never starts a drag.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  const slots = gridSlots();
  const bodyHeight = GRID_TOTAL_MINUTES * PX_PER_MINUTE;

  const placed = (nodes ?? []).filter((node) => node.plannedStart != null);

  const createAt = (offsetMinutes: number) => {
    const start = slotDate(new Date(), offsetMinutes);
    const end = slotDate(new Date(), offsetMinutes + DEFAULT_BLOCK_MINUTES);
    addNode.mutate({
      title: "New task",
      type: "task",
      plannedStart: start,
      plannedEnd: end,
    });
  };

  const handleBodyClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const body = bodyRef.current;
    if (!body) return;
    const y = e.clientY - body.getBoundingClientRect().top;
    createAt(snapToSlot(y / PX_PER_MINUTE));
  };

  // Resolve a node's base span (falling back to a default length when it has no
  // explicit end), shared by the live preview and the commit on drag end.
  const baseSpan = (nodeId: string) => {
    const node = (nodes ?? []).find((n) => n.id === nodeId);
    if (!node?.plannedStart) return null;
    const start = new Date(node.plannedStart);
    const end = node.plannedEnd
      ? new Date(node.plannedEnd)
      : addMinutes(start, DEFAULT_BLOCK_MINUTES);
    return { node, start, end };
  };

  const handleDragMove = (e: DragMoveEvent) => {
    const data = e.active.data.current as DragData | undefined;
    if (!data) return;
    setDrag({
      nodeId: data.nodeId,
      mode: data.mode,
      deltaMinutes: snapMinutes(e.delta.y / PX_PER_MINUTE),
    });
  };

  const handleDragEnd = (e: DragEndEvent) => {
    setDrag(null);
    const data = e.active.data.current as DragData | undefined;
    if (!data) return;
    const base = baseSpan(data.nodeId);
    if (!base) return;
    const deltaMinutes = snapMinutes(e.delta.y / PX_PER_MINUTE);
    if (deltaMinutes === 0) return;

    if (data.mode === "move") {
      const span = moveBlock(base.start, base.end, deltaMinutes);
      updateNode.mutate({
        id: base.node.id,
        patch: { plannedStart: span.start, plannedEnd: span.end },
      });
    } else {
      const span = resizeBlockEnd(base.start, base.end, deltaMinutes);
      updateNode.mutate({ id: base.node.id, patch: { plannedEnd: span.end } });
    }
  };

  return (
    <section className="flex min-h-0 flex-col rounded-xl border border-border bg-panel p-5">
      <div className="mb-4">
        <h2 className="text-base font-semibold tracking-tight text-foreground">
          Plan
        </h2>
        <p className="mt-0.5 text-xs text-muted">
          Click an empty slot to add a task
        </p>
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
            {/* Time axis */}
            <div
              className="relative w-12 shrink-0"
              style={{ height: bodyHeight }}
            >
              {slots.map((slot) => (
                <span
                  key={slot.offsetMinutes}
                  className="absolute right-2 -translate-y-1/2 text-[10px] tabular-nums text-muted"
                  style={{ top: slot.offsetMinutes * PX_PER_MINUTE }}
                >
                  {slot.label}
                </span>
              ))}
            </div>

            {/* Grid body — click to create, blocks layered on top */}
            <div
              ref={bodyRef}
              onClick={handleBodyClick}
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

              {placed.map((node) => {
                const start = new Date(node.plannedStart as Date);
                const end = node.plannedEnd
                  ? new Date(node.plannedEnd as Date)
                  : addMinutes(start, DEFAULT_BLOCK_MINUTES);

                // Apply the live drag/resize preview with the exact same pure
                // math that the commit uses, so what you see is what you get.
                const span =
                  drag?.nodeId === node.id
                    ? drag.mode === "move"
                      ? moveBlock(start, end, drag.deltaMinutes)
                      : resizeBlockEnd(start, end, drag.deltaMinutes)
                    : { start, end };

                const mins = durationMinutes(span.start, span.end);
                return (
                  <CalendarBlock
                    key={node.id}
                    node={node}
                    top={blockTopMinutes(span.start) * PX_PER_MINUTE}
                    height={Math.max(mins, 30) * PX_PER_MINUTE}
                    isDragging={drag?.nodeId === node.id}
                  />
                );
              })}
            </div>
          </div>
        </DndContext>
      )}
    </section>
  );
}
