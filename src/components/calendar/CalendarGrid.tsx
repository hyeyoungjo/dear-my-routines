"use client";

import { useEffect, useRef, useState } from "react";
import {
  GRID_TOTAL_MINUTES,
  blockPixelHeight,
  blockTopMinutes,
  durationMinutes,
  gridSlots,
  layoutOverlaps,
  moveBlock,
  resizeBlockEnd,
  slotDate,
  snapMinutes,
  snapToSlot,
  type Span,
} from "@/core/time/calendar";
import {
  blockSpan,
  blocksForDay,
  carryCountOf,
  carryOverBlock,
  type FlatBlock,
} from "@/core/time/blocks";
import { addDays, dayKey } from "@/core/time/day";
import { ancestorOfType } from "@/core/tree/tree";
import { projectColor } from "@/lib/projectColor";
import {
  CalendarBlock,
  type CalBlock,
  type ColumnKind,
} from "@/components/calendar/CalendarBlock";
import { useSelectedDate } from "@/components/date";
import {
  useAddBlock,
  useBlocks,
  useUpdateBlock,
} from "@/hooks/blocks";
import { useAddNode, useNodes } from "@/hooks/nodes";

/** Pixel height of one hour row; the whole grid scales off this. */
const SLOT_HEIGHT = 48;
const PX_PER_MINUTE = SLOT_HEIGHT / 60;
/** Default length of a freshly-created block (one hour). */
const DEFAULT_BLOCK_MINUTES = 60;

type DragMode = "move" | "resize";
/**
 * Live state of a pointer drag. `startX/startY` are the pointer position at
 * press; `deltaMinutes` is the snapped vertical move (drives the preview span),
 * `deltaX` the raw horizontal move (drives the live column choice). The drag
 * target is a `task_block` occurrence, keyed by `blockId` (ADR-014).
 */
type DragPreview = {
  column: ColumnKind;
  blockId: string;
  mode: DragMode;
  startX: number;
  startY: number;
  /** Pointer x inside the column at press, so dropX = startColX + deltaX. */
  startColX: number;
  /** The dragged block's slot at press — held fixed so its left/width stay put
   *  while the transform follows the cursor (neighbours reflow around it). */
  startCol: number;
  startCols: number;
  deltaMinutes: number;
  deltaX: number;
};

/**
 * The span a block occupies in a column: the planned pair for Plan, the actual
 * pair for Action — falling back to the plan span as a faint "ghost" when no
 * actual is recorded yet (the ghost is confirmed/dragged into the actual fields,
 * see commitDrag/onConfirm). All edges read from the block's own fields
 * (ADR-014); the calendar no longer touches the node's legacy time columns.
 */
function readBlockSpan(block: FlatBlock, kind: ColumnKind): Span | null {
  if (kind === "plan") return blockSpan(block, "plan");
  return blockSpan(block, "actual") ?? blockSpan(block, "plan");
}

/** Patch that writes a whole span (move) into the column's field pair. */
function movePatch(kind: ColumnKind, span: Span): Partial<FlatBlock> {
  return kind === "plan"
    ? {
        plannedStart: span.start.toISOString(),
        plannedEnd: span.end.toISOString(),
      }
    : {
        actualStart: span.start.toISOString(),
        actualEnd: span.end.toISOString(),
      };
}

/** Patch that writes only the end (resize) into the column's field pair. */
function resizePatch(kind: ColumnKind, span: Span): Partial<FlatBlock> {
  return kind === "plan"
    ? { plannedEnd: span.end.toISOString() }
    : { actualEnd: span.end.toISOString() };
}

/**
 * Two-column day view (07:00 → 02:00, PRD "예상 vs. 실제"): a Plan column
 * (block planned span) on the left and an Action column (block actual span) on
 * the right, sharing one time axis down the middle so the same wall-clock time
 * sits at the same height in both. Each drawn block is one `task_block`
 * occurrence (ADR-014) — a task can have several across days; only those
 * belonging to the selected grid day are shown (`blocksForDay`). The task's
 * title and project colour are joined in from its `node`.
 *
 * Clicking an empty slot creates a one-hour task there (a new node + its first
 * block, optimistically); a plan block also shows a ghost in the Action column
 * that, once confirmed or dragged, lines the task up across both columns so its
 * estimate-vs-actual delta is visible (only when both spans exist, ADR-014).
 *
 * Blocks can be dragged to move and edge-dragged to resize via plain pointer
 * events (no drag library — it fought our live re-layout and jittered). A press
 * on a block records the start point; the grid tracks the pointer on `window`,
 * converting the vertical delta to a snapped minute delta (previewed live) and
 * the horizontal delta to a column choice. On release both are committed through
 * the optimistic `useUpdateBlock` hook into that block's own span, so the change
 * shows instantly and rolls back on failure (CLAUDE.md CRITICAL). All schedule
 * math comes from the pure `core/time` helpers — this component only turns
 * minutes into pixels and back, and picks which field pair a column owns.
 */
export function CalendarGrid() {
  const { data: blockData, isLoading, isError } = useBlocks();
  const { data: nodeData } = useNodes();
  const { selectedDate } = useSelectedDate();
  const addNode = useAddNode();
  const addBlock = useAddBlock();
  const updateBlock = useUpdateBlock();
  const planBodyRef = useRef<HTMLDivElement>(null);
  const actionBodyRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<DragPreview | null>(null);
  // Mirror the latest drag so the window pointerup handler (registered once per
  // drag) can read the final deltas without re-subscribing on every move.
  const dragRef = useRef<DragPreview | null>(null);
  dragRef.current = drag;
  // Set true on release after a real (moved) drag, so the trailing click the
  // browser fires doesn't reach the grid and create a new task.
  const justDraggedRef = useRef(false);

  const slots = gridSlots();
  const bodyHeight = GRID_TOTAL_MINUTES * PX_PER_MINUTE;
  const allBlocks = blockData ?? [];
  const allNodes = nodeData ?? [];

  // Index nodes by id (title/colour join) and group blocks by node (carryCount).
  const nodeById = new Map(allNodes.map((n) => [n.id, n]));
  const blocksByNode = new Map<string, FlatBlock[]>();
  for (const b of allBlocks) {
    const list = blocksByNode.get(b.nodeId) ?? [];
    list.push(b);
    blocksByNode.set(b.nodeId, list);
  }

  const createAt = (offsetMinutes: number, kind: ColumnKind) => {
    const start = slotDate(selectedDate, offsetMinutes);
    const end = slotDate(selectedDate, offsetMinutes + DEFAULT_BLOCK_MINUTES);
    // A new task is a node (identity) plus its first block (this day's placement).
    // The node id is server-assigned, so the block is created in the node's
    // onSuccess; both writes are optimistic, so the screen stays responsive.
    addNode.mutate(
      { title: "", type: "task" },
      {
        onSuccess: (node) =>
          addBlock.mutate({
            nodeId: node.id,
            gridDay: dayKey(selectedDate),
            ...(kind === "plan"
              ? {
                  plannedStart: start.toISOString(),
                  plannedEnd: end.toISOString(),
                }
              : {
                  actualStart: start.toISOString(),
                  actualEnd: end.toISOString(),
                }),
          }),
      },
    );
  };

  /**
   * Carry a ghost (a planned occurrence not yet acted on) forward (ADR-014): mark
   * THIS block `missed` so it stays here as the "planned but undone" record, and
   * create a fresh planned block on the next day (clock + duration kept). This is
   * a deliberate carry, distinct from a manual reschedule — only here do we touch
   * status/carryCount. Both writes are optimistic, so the columns update at once.
   */
  const carryOver = (block: FlatBlock) => {
    const { missedPatch, nextBlock } = carryOverBlock(
      block,
      addDays(selectedDate, 1),
    );
    updateBlock.mutate({ id: block.id, patch: missedPatch });
    addBlock.mutate(nextBlock);
  };

  const handleBodyClick = (
    e: React.MouseEvent<HTMLDivElement>,
    kind: ColumnKind,
  ) => {
    // Swallow the click the browser fires right after a drag release.
    if (justDraggedRef.current) {
      justDraggedRef.current = false;
      return;
    }
    const body = (kind === "plan" ? planBodyRef : actionBodyRef).current;
    if (!body) return;
    const y = e.clientY - body.getBoundingClientRect().top;
    createAt(snapToSlot(y / PX_PER_MINUTE), kind);
  };

  /** A block was pressed — begin tracking a move/resize from the pointer. */
  const handleDragStart = (
    blockId: string,
    column: ColumnKind,
    mode: DragMode,
    clientX: number,
    clientY: number,
  ) => {
    const body = (column === "plan" ? planBodyRef : actionBodyRef).current;
    const colWidth = body?.offsetWidth ?? 0;
    // Freeze the dragged block's current slot so its left/width hold steady while
    // the transform glides it under the cursor; neighbours reflow around it.
    const startBlocks = buildColumnBlocks(column);
    const layoutItems = startBlocks.map((b) => ({
      span: b.span,
      node: { sortOrder: b.block.sortOrder },
    }));
    const idx = startBlocks.findIndex((b) => b.block.id === blockId);
    const startSlot =
      idx >= 0 ? layoutOverlaps(layoutItems).get(layoutItems[idx]) : undefined;
    const col = startSlot?.col ?? 0;
    const cols = startSlot?.cols ?? 1;
    setDrag({
      blockId,
      column,
      mode,
      startX: clientX,
      startY: clientY,
      // Column is chosen by the block's CENTRE, not the grab point: the centre's
      // x in the column is (col + 0.5)/cols * width; deltaX shifts it while dragging.
      startColX: ((col + 0.5) / cols) * colWidth,
      startCol: col,
      startCols: cols,
      deltaMinutes: 0,
      deltaX: 0,
    });
  };

  /** Commit a finished drag `d`: vertical span move/resize + horizontal column. */
  const commitDrag = (d: DragPreview | null) => {
    if (!d) return;
    const { blockId, column, mode, deltaMinutes } = d;
    const block = allBlocks.find((b) => b.id === blockId);
    if (!block) return;
    const base = readBlockSpan(block, column);
    if (!base) return;

    // Horizontal drag (move only) → column order via sortOrder. Done before the
    // vertical-zero early return so a pure sideways drag still re-columns.
    if (mode === "move") {
      // Manual order: the column-x where the user dropped IS the sortOrder
      // (layoutOverlaps lays blocks left→right by it) — not an auto/relative bump.
      const dropX = Math.round(d.startColX + d.deltaX);
      if (dropX !== Math.round(d.startColX)) {
        updateBlock.mutate({ id: block.id, patch: { sortOrder: dropX } });
      }
    }

    // No vertical change → the sortOrder above (if any) already handled it.
    if (deltaMinutes === 0) return;

    // Each block is independent (ADR-014) — move shifts both edges, resize the
    // end. The patch writes into this column's own field pair (so dragging a
    // ghost in the Action column turns it into a real actual span). Optimistic
    // via useUpdateBlock, so the screen never waits (ADR-007).
    const span =
      mode === "move"
        ? moveBlock(base.start, base.end, deltaMinutes)
        : resizeBlockEnd(base.start, base.end, deltaMinutes);
    updateBlock.mutate({
      id: block.id,
      patch: mode === "move" ? movePatch(column, span) : resizePatch(column, span),
    });
  };

  // While a drag is active, track the pointer on `window` (so it keeps following
  // even if the cursor leaves the block) and commit on release. Registered once
  // per drag — keyed by the stable session fields, not the live deltas — so the
  // listeners aren't re-subscribed on every move.
  useEffect(() => {
    if (!drag) return;
    const onMove = (e: PointerEvent) => {
      setDrag((prev) => {
        if (!prev) return prev;
        const deltaMinutes = snapMinutes((e.clientY - prev.startY) / PX_PER_MINUTE);
        // Clamp horizontal to the block's own column so a plan block can't drift
        // into the action column (and vice versa) — the two columns are distinct.
        const body = (prev.column === "plan" ? planBodyRef : actionBodyRef).current;
        let deltaX = e.clientX - prev.startX;
        if (body) {
          const rect = body.getBoundingClientRect();
          deltaX =
            Math.max(rect.left, Math.min(e.clientX, rect.right)) - prev.startX;
        }
        // Skip the re-render unless the snapped position or column actually moved.
        if (prev.deltaMinutes === deltaMinutes && prev.deltaX === deltaX) {
          return prev;
        }
        return { ...prev, deltaMinutes, deltaX };
      });
    };
    const onUp = () => {
      const d = dragRef.current;
      if (d && (d.deltaMinutes !== 0 || Math.abs(d.deltaX) > 3)) {
        justDraggedRef.current = true;
      }
      commitDrag(d);
      setDrag(null);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
    // Re-subscribe only when a new drag session starts/ends, not on each delta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag?.blockId, drag?.mode, drag?.column]);

  /**
   * Build the flat list of blocks visible in a column for the selected grid day.
   * A block is visible when it has a span here (`readBlockSpan`); its owning node
   * supplies the title/colour join (orphan blocks with no node are skipped). The
   * live drag/resize preview is applied to the dragged block via the same pure
   * math the commit uses. Blocks are independent occurrences (ADR-014) — no
   * nesting; all schedule math stays in `core/`.
   */
  const buildColumnBlocks = (kind: ColumnKind): CalBlock[] => {
    const result: CalBlock[] = [];
    for (const block of blocksForDay(allBlocks, selectedDate)) {
      const base = readBlockSpan(block, kind);
      if (!base) continue;
      const node = nodeById.get(block.nodeId);
      if (!node) continue; // orphan block — nothing to title/colour it with.

      // Own span, with the live drag/resize preview applied via the same pure
      // math the commit uses.
      const own =
        drag?.column === kind && drag.blockId === block.id
          ? drag.mode === "move"
            ? moveBlock(base.start, base.end, drag.deltaMinutes)
            : resizeBlockEnd(base.start, base.end, drag.deltaMinutes)
          : base;

      const project = ancestorOfType(allNodes, node.id, "project");
      // A ghost: shown in the Action column from the plan span, no actual yet.
      const isPlaceholder = kind === "action" && block.actualStart == null;
      const planSpan = kind === "action" ? blockSpan(block, "plan") : null;

      result.push({
        block,
        node,
        span: own,
        color: project?.color ?? projectColor(project?.id ?? null),
        isPlaceholder,
        // Estimate-vs-actual delta only when this block has BOTH a plan and a
        // real actual (ADR-014) — never for a ghost (actual not yet recorded).
        comparison:
          planSpan && !isPlaceholder
            ? {
                plannedMinutes: durationMinutes(planSpan.start, planSpan.end),
                actualMinutes: durationMinutes(own.start, own.end),
              }
            : undefined,
        carryCount: carryCountOf(blocksByNode.get(block.nodeId) ?? []),
      });
    }
    return result;
  };

  /** Render one column's grid body: hour lines, click-to-create, and blocks. */
  const renderColumn = (kind: ColumnKind) => (
    <div
      ref={kind === "plan" ? planBodyRef : actionBodyRef}
      onClick={(e) => handleBodyClick(e, kind)}
      className="relative flex-1 cursor-pointer overflow-hidden border-l border-grid"
      style={{ height: bodyHeight }}
    >
      {slots.slice(0, -1).map((slot) => (
        <div
          key={slot.offsetMinutes}
          className="absolute inset-x-0 border-t border-grid"
          style={{ top: slot.offsetMinutes * PX_PER_MINUTE }}
        />
      ))}

      {(() => {
        // Side-by-side layout from live (preview) spans, so widths adapt in real
        // time as overlaps change. During a horizontal move, the dragged block
        // gets a PROVISIONAL sortOrder = its drop position (startColX + deltaX),
        // so neighbours reflow live and the drop lands where it previews (no
        // post-drop flicker — the preview already equals the committed order).
        const colBlocks = buildColumnBlocks(kind);
        const movingHere = drag?.column === kind && drag.mode === "move";
        // layoutOverlaps orders blocks by sortOrder; the dragged block uses its
        // live drop position so neighbours reflow around it (a plain object — the
        // pure helper only needs { span, node: { sortOrder } }).
        const layoutItems = colBlocks.map((b) => ({
          span: b.span,
          node: {
            sortOrder:
              movingHere && b.block.id === drag.blockId
                ? Math.round(drag.startColX + drag.deltaX)
                : b.block.sortOrder,
          },
        }));
        const laid = layoutOverlaps(layoutItems);
        return colBlocks.map((block, i) => {
          const isDraggedHere =
            drag != null &&
            drag.column === kind &&
            drag.blockId === block.block.id;
          const isMovingThis = isDraggedHere && drag.mode === "move";
          // Neighbours take their live (provisional) slot so they reflow. The
          // moved block keeps its START slot and glides via transform(deltaX) —
          // following the cursor smoothly instead of snapping column to column.
          const slot = isMovingThis
            ? { col: drag.startCol, cols: drag.startCols }
            : (laid.get(layoutItems[i]) ?? { col: 0, cols: 1 });
          const widthPct = 100 / slot.cols;
          return (
            <CalendarBlock
              key={block.block.id}
              block={block}
              column={kind}
              // Clicking a ghost (no drag) confirms it: copy the plan span into
              // the actual fields so it turns into a real Action block.
              onConfirm={
                block.isPlaceholder
                  ? () => {
                      if (justDraggedRef.current) return;
                      updateBlock.mutate({
                        id: block.block.id,
                        patch: {
                          actualStart: block.block.plannedStart,
                          actualEnd: block.block.plannedEnd,
                        },
                      });
                    }
                  : undefined
              }
              // Ghost ✕ carries this occurrence forward (missed here + new block
              // tomorrow); real blocks have no carry control.
              onCarryOver={
                block.isPlaceholder ? () => carryOver(block.block) : undefined
              }
              onDragStart={handleDragStart}
              // Moved block follows the cursor via transform(deltaX); resize just
              // gets the dragging highlight (0); others none.
              dragDeltaX={
                isDraggedHere ? (drag.mode === "move" ? drag.deltaX : 0) : null
              }
              style={{
                top: blockTopMinutes(block.span.start) * PX_PER_MINUTE,
                height: blockPixelHeight(block, PX_PER_MINUTE),
                left: `calc(${slot.col * widthPct}% + 2px)`,
                width: `calc(${widthPct}% - 4px)`,
              }}
            />
          );
        });
      })()}
    </div>
  );

  return (
    <section className="flex min-h-0 flex-col rounded-xl border border-border bg-panel p-5">
      {/* Column headers aligned to the body layout below. */}
      <div className="mb-4 flex items-baseline">
        <h2 className="flex-1 text-center text-base font-semibold tracking-tight text-foreground">
          Plan
        </h2>
        <div className="w-14 shrink-0" aria-hidden />
        <h2 className="flex-1 text-center text-base font-semibold tracking-tight text-foreground">
          Action
        </h2>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : isError ? (
        <p className="text-sm text-red-500">Failed to load.</p>
      ) : (
        <div className="flex">
          {/* Left: Plan column */}
          {renderColumn("plan")}

          {/* Center: shared time axis */}
          <div className="relative w-14 shrink-0" style={{ height: bodyHeight }}>
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
      )}
    </section>
  );
}
