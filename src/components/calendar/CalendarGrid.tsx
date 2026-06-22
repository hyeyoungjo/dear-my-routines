"use client";

import { useEffect, useRef, useState } from "react";
import {
  GRID_TOTAL_MINUTES,
  addMinutes,
  blockPixelHeight,
  blockTopMinutes,
  clampChildToParent,
  durationMinutes,
  fitParentToChildren,
  gridSlots,
  layoutOverlaps,
  moveBlock,
  resizeBlockEnd,
  slotDate,
  snapMinutes,
  snapToSlot,
  type Span,
} from "@/core/time/calendar";
import { nodesForDay } from "@/core/time/day";
import { ancestorOfType } from "@/core/tree/tree";
import type { FlatNode } from "@/core/tree/types";
import type { NewNode } from "@/db/schema";
import { projectColor } from "@/lib/projectColor";
import {
  CalendarBlock,
  type CalBlock,
  type ColumnKind,
} from "@/components/calendar/CalendarBlock";
import { useSelectedDate } from "@/components/date";
import {
  useAddNode,
  useNodes,
  useUpdateNode,
  type UpdateNodeInput,
} from "@/hooks/nodes";

/** Pixel height of one hour row; the whole grid scales off this. */
const SLOT_HEIGHT = 48;
const PX_PER_MINUTE = SLOT_HEIGHT / 60;
/** Default length of a freshly-created block (one hour). */
const DEFAULT_BLOCK_MINUTES = 60;

type DragMode = "move" | "resize";
/**
 * Live state of a pointer drag. `startX/startY` are the pointer position at
 * press; `deltaMinutes` is the snapped vertical move (drives the preview span),
 * `deltaX` the raw horizontal move (drives the live column choice).
 */
type DragPreview = {
  column: ColumnKind;
  nodeId: string;
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
 * Read a node's span for a column from the matching field pair (planned vs.
 * actual), falling back to a default length when the end is unset. Returns null
 * when the column's start is unset — i.e. the block does not belong here.
 */
function readSpan(node: FlatNode, kind: ColumnKind): Span | null {
  let startVal = kind === "plan" ? node.plannedStart : node.actualStart;
  let endVal = kind === "plan" ? node.plannedEnd : node.actualEnd;
  // Action column: when no actual is recorded yet, fall back to the plan span so
  // a faint "ghost" placeholder shows on the right automatically. Dragging it
  // writes the actual fields (see commitDrag), turning the ghost real.
  if (kind === "action" && startVal == null) {
    startVal = node.plannedStart;
    endVal = node.plannedEnd;
  }
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
 * Blocks can be dragged to move and edge-dragged to resize via plain pointer
 * events (no drag library — it fought our live re-layout and jittered). A press
 * on a block records the start point; the grid tracks the pointer on `window`,
 * converting the vertical delta to a snapped minute delta (previewed live) and
 * the horizontal delta to a column choice. On release both are committed through
 * the optimistic `useUpdateNode` hook into the column's own field pair, so the
 * change shows instantly and rolls back on failure (CLAUDE.md CRITICAL). All
 * schedule math comes from the pure `core/time` helpers — this component only
 * turns minutes into pixels and back, and picks which field pair a column owns.
 */
export function CalendarGrid() {
  const { data: nodes, isLoading, isError } = useNodes();
  const { selectedDate } = useSelectedDate();
  const addNode = useAddNode();
  const updateNode = useUpdateNode();
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
  // Scope to the selected grid day — the rows are the source of truth, this is
  // just today's view over them (ADR-013).
  const all = nodesForDay(nodes ?? [], selectedDate);

  const createAt = (offsetMinutes: number, kind: ColumnKind) => {
    const start = slotDate(selectedDate, offsetMinutes);
    const end = slotDate(selectedDate, offsetMinutes + DEFAULT_BLOCK_MINUTES);
    addNode.mutate({
      title: "",
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
    nodeId: string,
    column: ColumnKind,
    mode: DragMode,
    clientX: number,
    clientY: number,
  ) => {
    const body = (column === "plan" ? planBodyRef : actionBodyRef).current;
    const colWidth = body?.offsetWidth ?? 0;
    // Freeze the dragged block's current slot so its left/width hold steady while
    // the transform glides it under the cursor; neighbours reflow around it.
    const startBlocks = buildColumnTree(column);
    const startBlock = startBlocks.find((b) => b.node.id === nodeId);
    const startSlot = startBlock
      ? layoutOverlaps(startBlocks).get(startBlock)
      : undefined;
    const col = startSlot?.col ?? 0;
    const cols = startSlot?.cols ?? 1;
    setDrag({
      nodeId,
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

  /**
   * The block a node renders nested inside for this column: its direct parent,
   * but only when that parent also has a span here (matches buildColumnTree's
   * rule — a node whose parent is invisible in this column is drawn as a root).
   * Returns null for a top-level block.
   */
  const visibleParent = (node: FlatNode, kind: ColumnKind): FlatNode | null => {
    if (node.parentId == null) return null;
    const parent = all.find((n) => n.id === node.parentId);
    if (!parent) return null;
    return readSpan(parent, kind) != null ? parent : null;
  };

  /** Commit a finished drag `d`: vertical span move/resize + horizontal column. */
  const commitDrag = (d: DragPreview | null) => {
    if (!d) return;
    const { nodeId, column, mode, deltaMinutes } = d;
    const node = all.find((n) => n.id === nodeId);
    if (!node) return;
    const base = readSpan(node, column);
    if (!base) return;

    // Horizontal drag (move only) → column order via sortOrder. Done before the
    // vertical-zero early return so a pure sideways drag still re-columns.
    if (mode === "move") {
      // Manual order: the column-x where the user dropped IS the sortOrder
      // (layoutOverlaps lays blocks left→right by it) — not an auto/relative bump.
      const dropX = Math.round(d.startColX + d.deltaX);
      if (dropX !== Math.round(d.startColX)) {
        updateNode.mutate({ id: node.id, patch: { sortOrder: dropX } });
      }
    }

    // No vertical change → the sortOrder above (if any) already handled it.
    if (deltaMinutes === 0) return;

    // The dragged block's own new span (move shifts both edges, resize the end).
    const ownSpan =
      mode === "move"
        ? moveBlock(base.start, base.end, deltaMinutes)
        : resizeBlockEnd(base.start, base.end, deltaMinutes);

    // Commit the dragged block, then walk up its visible-parent chain growing
    // each ancestor to wrap the level below when it overflows (ADR-009 frame-in-
    // frame): the child is clamped inside its parent (clampChildToParent) and the
    // parent's stored span is stretched (fitParentToChildren) to contain it,
    // cascading up to arbitrary depth. A top-level block has no parent and simply
    // commits its own span — identical to the flat (step 2) behaviour. Each patch
    // goes through the optimistic useUpdateNode, so the screen never waits.
    const patches: UpdateNodeInput[] = [];
    let current: FlatNode = node;
    let currentSpan = ownSpan;
    let isDraggedNode = true;

    for (;;) {
      const parent = visibleParent(current, column);

      // resize only ever moves the dragged block's own end; every other write —
      // a clamped move, or a grown ancestor whose start and/or end shifted — is a
      // whole-span move.
      const writeWholeSpan = !(isDraggedNode && mode === "resize");

      if (!parent) {
        patches.push({
          id: current.id,
          patch: writeWholeSpan
            ? movePatch(column, currentSpan)
            : resizePatch(column, currentSpan),
        });
        break;
      }

      const parentBase = readSpan(parent, column)!;
      const grown = fitParentToChildren(parentBase, [currentSpan]);
      // Keep this level inside its parent. Once the parent has grown to wrap an
      // overflowing child this is a no-op; it guards the child ⊆ parent invariant.
      const clamped = clampChildToParent(currentSpan, grown);
      patches.push({
        id: current.id,
        patch: writeWholeSpan
          ? movePatch(column, clamped)
          : resizePatch(column, clamped),
      });

      const parentGrew =
        grown.start.getTime() !== parentBase.start.getTime() ||
        grown.end.getTime() !== parentBase.end.getTime();
      if (!parentGrew) break; // parent already contains the child — nothing above changes.

      current = parent;
      currentSpan = grown;
      isDraggedNode = false;
    }

    for (const patch of patches) updateNode.mutate(patch);
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
  }, [drag?.nodeId, drag?.mode, drag?.column]);

  /**
   * Build the nested block tree for a column. Only nodes that have a span in this
   * column are visible; a visible node nests under its parent when the parent is
   * also visible here, otherwise it becomes a root. Each node's `span` is its own
   * (live-preview-applied) span grown to wrap its children's effective spans
   * (`fitParentToChildren`), bottom-up — so a parent auto-expands when subtasks
   * overflow, to arbitrary depth (ADR-009). All schedule math stays in `core/`.
   */
  const buildColumnTree = (kind: ColumnKind): CalBlock[] => {
    // Project > Task only. Tasks are the time blocks; Project is a legend
    // grouping (colour). Subtasks/areas were removed, so only tasks are drawn.
    const visible = all.filter(
      (node) => readSpan(node, kind) != null && node.type === "task",
    );
    const visibleIds = new Set(visible.map((node) => node.id));
    const childrenOf = new Map<string | null, FlatNode[]>();
    for (const node of visible) {
      const parentKey =
        node.parentId != null && visibleIds.has(node.parentId)
          ? node.parentId
          : null;
      const list = childrenOf.get(parentKey) ?? [];
      list.push(node);
      childrenOf.set(parentKey, list);
    }

    const buildBlock = (node: FlatNode): CalBlock => {
      const children = (childrenOf.get(node.id) ?? []).map(buildBlock);

      // Own span, with the live drag/resize preview applied via the same pure
      // math the commit uses (top-level only — nested blocks don't drag here).
      const base = readSpan(node, kind)!;
      const own =
        drag?.column === kind && drag.nodeId === node.id
          ? drag.mode === "move"
            ? moveBlock(base.start, base.end, drag.deltaMinutes)
            : resizeBlockEnd(base.start, base.end, drag.deltaMinutes)
          : base;

      const span = fitParentToChildren(
        own,
        children.map((child) => child.span),
      );
      const project = ancestorOfType(all, node.id, "project");
      // A ghost: shown in the Action column from the plan span, no actual yet.
      const isPlaceholder = kind === "action" && node.actualStart == null;
      const planSpan = kind === "action" ? readSpan(node, "plan") : null;

      return {
        node,
        span,
        color: project?.color ?? projectColor(project?.id ?? null),
        isPlaceholder,
        // Estimate-vs-actual delta only once a real actual exists (not for ghosts).
        comparison:
          planSpan && !isPlaceholder
            ? {
                plannedMinutes: durationMinutes(planSpan.start, planSpan.end),
                actualMinutes: durationMinutes(own.start, own.end),
              }
            : undefined,
        children,
      };
    };

    return (childrenOf.get(null) ?? []).map(buildBlock);
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
        const blocks = buildColumnTree(kind);
        const movingHere = drag?.column === kind && drag.mode === "move";
        const items = movingHere
          ? blocks.map((b) =>
              b.node.id === drag.nodeId
                ? {
                    ...b,
                    node: {
                      ...b.node,
                      sortOrder: Math.round(drag.startColX + drag.deltaX),
                    },
                  }
                : b,
            )
          : blocks;
        const laid = layoutOverlaps(items);
        return blocks.map((block, i) => {
          const lb = items[i];
          const isDraggedHere =
            drag != null &&
            drag.column === kind &&
            drag.nodeId === block.node.id;
          const isMovingThis = isDraggedHere && drag.mode === "move";
          // Neighbours take their live (provisional) slot so they reflow. The
          // moved block keeps its START slot and glides via transform(deltaX) —
          // following the cursor smoothly instead of snapping column to column.
          // Neighbours take their live (provisional) slot so they reflow. The
          // moved block keeps its START slot and glides via transform(deltaX) —
          // following the cursor smoothly instead of snapping column to column.
          const slot = isMovingThis
            ? { col: drag.startCol, cols: drag.startCols }
            : (laid.get(lb) ?? { col: 0, cols: 1 });
          const widthPct = 100 / slot.cols;
          return (
            <CalendarBlock
              key={block.node.id}
              block={block}
              column={kind}
              onDragStart={handleDragStart}
              // Moved block follows the cursor via transform(deltaX); resize just
              // gets the dragging highlight (0); others none.
              dragDeltaX={
                isDraggedHere ? (drag.mode === "move" ? drag.deltaX : 0) : null
              }
              style={{
                top: blockTopMinutes(lb.span.start) * PX_PER_MINUTE,
                height: blockPixelHeight(lb, PX_PER_MINUTE),
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
