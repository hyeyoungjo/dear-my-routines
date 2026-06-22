"use client";

import { useEffect, useRef } from "react";
import { shiftActualToDate, shiftPlannedToDate } from "@/core/time/carry";
import { dayFromKey, gridDayOf } from "@/core/time/day";
import type { FlatNode } from "@/core/tree/types";
import { useNodes, useUpdateNode } from "@/hooks/nodes";
import { useSelectedDate } from "@/components/date";
import { MiniCalendar } from "@/components/MiniCalendar";

/** The grid day (as a Date) a span currently sits on — for the picker highlight. */
function gridDayDate(ts: Date | string): Date {
  return dayFromKey(gridDayOf(new Date(ts)));
}

/**
 * The detail editor for a single task, opened by double-clicking its block. Its
 * reason for existing is the *manual* date move: the user reschedules the planned
 * (and, if recorded, actual) span via the same `MiniCalendar` the rest of the app
 * uses. This is deliberately NOT a carry-over — `shiftPlannedToDate` /
 * `shiftActualToDate` keep clock + duration but never touch carryCount or status,
 * so "I moved this on purpose" stays distinct from "I didn't get to it" (ADR-009,
 * which keeps the subproject-detection signal clean). All date math lives in
 * `core/time`; here we only wire pickers to the optimistic update (ADR-007).
 */
export function NodeDetailModal({
  node,
  onClose,
}: {
  node: FlatNode;
  onClose: () => void;
}) {
  const updateNode = useUpdateNode();
  const { selectedDate } = useSelectedDate();
  const { data: allNodes } = useNodes();
  // Track the live row so the pickers re-highlight after each optimistic shift.
  const live = allNodes?.find((n) => n.id === node.id) ?? node;

  const titleRef = useRef<HTMLTextAreaElement>(null);

  // Esc closes; focus moves into the dialog on open (accessibility).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    titleRef.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const commitTitle = (value: string) => {
    const title = value.trim();
    if (title !== live.title) updateNode.mutate({ id: live.id, patch: { title } });
  };
  const commitNotes = (value: string) => {
    const notes = value.length ? value : null;
    if (notes !== (live.notes ?? null))
      updateNode.mutate({ id: live.id, patch: { notes } });
  };

  // Where each picker opens / highlights: the span's current grid day, else the
  // plannedDate column, else the day in view.
  const plannedSelected = live.plannedStart
    ? gridDayDate(live.plannedStart)
    : live.plannedDate
      ? dayFromKey(live.plannedDate)
      : selectedDate;
  const actualSelected = live.actualStart
    ? gridDayDate(live.actualStart)
    : selectedDate;

  const heading = "mb-1 text-xs font-medium text-muted";

  return (
    // Backdrop click closes; clicks inside the dialog are stopped below.
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Task details"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl rounded-xl border border-border bg-panel p-4 shadow-lg"
      >
        <div className="mb-3 flex items-start justify-between gap-2">
          <textarea
            ref={titleRef}
            defaultValue={live.title}
            placeholder="New task"
            onBlur={(e) => commitTitle(e.target.value)}
            rows={1}
            aria-label="Title"
            className="min-h-0 flex-1 resize-none break-words [field-sizing:content] bg-transparent text-base font-medium leading-tight text-foreground placeholder:font-normal placeholder:text-muted focus:outline-none"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            title="Close"
            className="shrink-0 rounded-md px-1 text-muted transition-colors hover:bg-accent-soft hover:text-foreground"
          >
            ✕
          </button>
        </div>

        <textarea
          defaultValue={live.notes ?? ""}
          placeholder="Notes"
          onBlur={(e) => commitNotes(e.target.value)}
          rows={2}
          aria-label="Notes"
          className="mb-4 w-full resize-none rounded-md border border-border bg-transparent p-2 text-sm leading-snug text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent/40"
        />

        <div className="flex flex-col gap-4 sm:flex-row">
          <div>
            <div className={heading}>Planned date</div>
            <MiniCalendar
              selected={plannedSelected}
              onSelect={(picked) =>
                updateNode.mutate({
                  id: live.id,
                  patch: shiftPlannedToDate(live, picked),
                })
              }
            />
          </div>
          <div>
            <div className={heading}>Actual date</div>
            <MiniCalendar
              selected={actualSelected}
              onSelect={(picked) => {
                // Empty patch when nothing was recorded yet — nothing to move.
                const patch = shiftActualToDate(live, picked);
                if (Object.keys(patch).length)
                  updateNode.mutate({ id: live.id, patch });
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
