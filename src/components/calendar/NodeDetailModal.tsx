"use client";

import { useEffect, useRef } from "react";
import {
  shiftBlockActual,
  shiftBlockPlanned,
  type FlatBlock,
} from "@/core/time/blocks";
import { shiftSpanOntoGridDay } from "@/core/time/carry";
import { dayFromKey, dayKey, gridDayOf } from "@/core/time/day";
import type { FlatNode } from "@/core/tree/types";
import { useBlocks, useUpdateBlock } from "@/hooks/blocks";
import { useNodes, useUpdateNode } from "@/hooks/nodes";
import { MiniCalendar } from "@/components/MiniCalendar";

/** The grid day (as a Date) a span currently sits on — for the picker highlight. */
function gridDayDate(ts: string): Date {
  return dayFromKey(gridDayOf(new Date(ts)));
}

/**
 * The detail editor for a single `task_block` occurrence, opened by
 * double-clicking its block. ADR-014: each day's occurrence is edited *on its
 * own* — moving this block's planned/actual date never touches the task's other
 * days. The title/notes belong to the task `node` (shared across days), the time
 * spans to this one block.
 *
 * Two distinct moves live here:
 *  - **Manual reschedule** — picking a date for a span that already exists shifts
 *    it (clock + duration kept) via `shiftBlockPlanned`/`shiftBlockActual`, which
 *    never touch carryCount or status: "I moved this on purpose" stays apart from
 *    "I didn't get to it" (ADR-009, keeping the subproject-detection signal clean).
 *  - **Actual "찍기"** — picking an actual date for a block that has *no* actual yet
 *    *creates* one from the planned clock and marks the block `done`. This is how
 *    an undone task gets its real time recorded after the fact.
 *
 * Every change saves the instant it happens (optimistic `useUpdateBlock` /
 * `useUpdateNode`, ADR-007) and the text is also flushed on close, so an edit is
 * never lost no matter how the dialog is dismissed (Esc / backdrop / ✕) — the
 * reported onBlur-only data loss. All date math stays in `core/time`.
 */
export function NodeDetailModal({
  block,
  node,
  onClose,
}: {
  block: FlatBlock;
  node: FlatNode;
  onClose: () => void;
}) {
  const updateNode = useUpdateNode();
  const updateBlock = useUpdateBlock();
  const { data: allNodes } = useNodes();
  const { data: allBlocks } = useBlocks();
  // Track the live rows so the editor reflects each optimistic write: the pickers
  // re-highlight and the next date pick reschedules from the updated span.
  const liveNode = allNodes?.find((n) => n.id === node.id) ?? node;
  const liveBlock = allBlocks?.find((b) => b.id === block.id) ?? block;

  const titleRef = useRef<HTMLTextAreaElement>(null);
  const notesRef = useRef<HTMLTextAreaElement>(null);

  // Title/notes belong to the task node. Commit them on blur AND on close so an
  // edit survives every dismissal path (the textareas are uncontrolled, so we
  // read the live DOM value and only write when it actually changed).
  const commitText = () => {
    const title = titleRef.current?.value.trim() ?? "";
    if (title !== liveNode.title)
      updateNode.mutate({ id: liveNode.id, patch: { title } });
    const raw = notesRef.current?.value ?? "";
    const notes = raw.length ? raw : null;
    if (notes !== (liveNode.notes ?? null))
      updateNode.mutate({ id: liveNode.id, patch: { notes } });
  };

  const close = () => {
    commitText();
    onClose();
  };

  // Esc closes (flushing text first); focus moves into the dialog on open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    titleRef.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Pick a date for this block's plan or actual span. If that span already
   * exists, reschedule it (status/carryCount untouched — a manual move is NOT a
   * carry-over). If it doesn't, *create* it from the other span's clock placed on
   * `picked`; recording an actual marks the block `done` (the actual "찍기").
   */
  const pickDate = (kind: "plan" | "actual", picked: Date) => {
    const ownStart =
      kind === "plan" ? liveBlock.plannedStart : liveBlock.actualStart;
    if (ownStart) {
      const patch =
        kind === "plan"
          ? shiftBlockPlanned(liveBlock, picked)
          : shiftBlockActual(liveBlock, picked);
      if (Object.keys(patch).length)
        updateBlock.mutate({ id: liveBlock.id, patch });
      return;
    }
    // No span of this kind yet → base a new one on the other span's clock.
    const srcStart =
      kind === "plan" ? liveBlock.actualStart : liveBlock.plannedStart;
    const srcEnd = kind === "plan" ? liveBlock.actualEnd : liveBlock.plannedEnd;
    if (!srcStart) return; // nothing to base a clock on
    const { start, end } = shiftSpanOntoGridDay(srcStart, srcEnd, picked);
    const patch: Partial<FlatBlock> =
      kind === "plan"
        ? {
            plannedStart: start.toISOString(),
            plannedEnd: end ? end.toISOString() : null,
            // A new plan span anchors the block's grid day to the picked date.
            gridDay: dayKey(picked),
          }
        : {
            actualStart: start.toISOString(),
            actualEnd: end ? end.toISOString() : null,
            status: "done",
          };
    updateBlock.mutate({ id: liveBlock.id, patch });
  };

  // Where each picker opens / highlights: the span's current grid day, else the
  // other span's day, else the block's stored grid day.
  const plannedSelected = liveBlock.plannedStart
    ? gridDayDate(liveBlock.plannedStart)
    : dayFromKey(liveBlock.gridDay);
  const actualSelected = liveBlock.actualStart
    ? gridDayDate(liveBlock.actualStart)
    : liveBlock.plannedStart
      ? gridDayDate(liveBlock.plannedStart)
      : dayFromKey(liveBlock.gridDay);

  const heading = "mb-1 text-xs font-medium text-muted";

  return (
    // Backdrop click closes; clicks inside the dialog are stopped below.
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={close}
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
            defaultValue={liveNode.title}
            placeholder="New task"
            onBlur={commitText}
            rows={1}
            aria-label="Title"
            className="min-h-0 flex-1 resize-none break-words [field-sizing:content] bg-transparent text-base font-medium leading-tight text-foreground placeholder:font-normal placeholder:text-muted focus:outline-none"
          />
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            title="Close"
            className="shrink-0 rounded-md px-1 text-muted transition-colors hover:bg-accent-soft hover:text-foreground"
          >
            ✕
          </button>
        </div>

        <textarea
          ref={notesRef}
          defaultValue={liveNode.notes ?? ""}
          placeholder="Notes"
          onBlur={commitText}
          rows={2}
          aria-label="Notes"
          className="mb-4 w-full resize-none rounded-md border border-border bg-transparent p-2 text-sm leading-snug text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent/40"
        />

        <div className="flex flex-col gap-4 sm:flex-row">
          <div>
            <div className={heading}>Planned date</div>
            <MiniCalendar
              selected={plannedSelected}
              onSelect={(picked) => pickDate("plan", picked)}
            />
          </div>
          <div>
            <div className={heading}>Actual date</div>
            <MiniCalendar
              selected={actualSelected}
              onSelect={(picked) => pickDate("actual", picked)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
