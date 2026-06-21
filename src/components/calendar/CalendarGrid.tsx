"use client";

import { useRef } from "react";
import {
  GRID_TOTAL_MINUTES,
  blockTopMinutes,
  durationMinutes,
  gridSlots,
  slotDate,
  snapToSlot,
} from "@/core/time/calendar";
import { CalendarBlock } from "@/components/calendar/CalendarBlock";
import { useAddNode, useNodes } from "@/hooks/nodes";

/** Pixel height of one hour row; the whole grid scales off this. */
const SLOT_HEIGHT = 48;
const PX_PER_MINUTE = SLOT_HEIGHT / 60;
/** Default length of a freshly-created block (one hour). */
const DEFAULT_BLOCK_MINUTES = 60;

/**
 * Google-Calendar-style day grid (07:00 → 02:00, PRD "하루를 한눈에"). Tasks with
 * a `plannedStart` are drawn as time-positioned blocks; clicking an empty slot
 * creates a one-hour task there (optimistically, via `useAddNode`). All schedule
 * math comes from the pure `core/time` helpers — this component only turns those
 * minutes into pixels. Drag/resize and the Act (actual) column are later steps.
 */
export function CalendarGrid() {
  const { data: nodes, isLoading, isError } = useNodes();
  const addNode = useAddNode();
  const bodyRef = useRef<HTMLDivElement>(null);

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
        <div className="flex">
          {/* Time axis */}
          <div className="relative w-12 shrink-0" style={{ height: bodyHeight }}>
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
                : null;
              const mins = end
                ? durationMinutes(start, end)
                : DEFAULT_BLOCK_MINUTES;
              return (
                <CalendarBlock
                  key={node.id}
                  node={node}
                  top={blockTopMinutes(start) * PX_PER_MINUTE}
                  height={Math.max(mins, 30) * PX_PER_MINUTE}
                />
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
