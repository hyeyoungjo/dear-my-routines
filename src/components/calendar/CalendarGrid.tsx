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
  blockPixelHeight,
  blockTopMinutes,
  clampChildToParent,
  durationMinutes,
  fitParentToChildren,
  gridSlots,
  moveBlock,
  resizeBlockEnd,
  slotDate,
  snapMinutes,
  snapToSlot,
  type Span,
} from "@/core/time/calendar";
import { ancestorOfType, childTypeOf } from "@/core/tree/tree";
import type { FlatNode } from "@/core/tree/types";
import type { NewNode } from "@/db/schema";
import { projectColor } from "@/lib/projectColor";
import {
  CalendarBlock,
  type CalBlock,
  type ColumnKind,
} from "@/components/calendar/CalendarBlock";
import {
  useAddNode,
  useNodes,
  useUpdateNode,
  type UpdateNodeInput,
} from "@/hooks/nodes";

/** Pixel height of one hour row; the whole grid scales off this. */
const SLOT_HEIGHT = 48;
const PX_PER_MINUTE = SLOT_HEIGHT / 60;
/** The title row is now an overlay (absolute) so it takes no vertical space —
 *  children align to pure time. Kept as 0 to feed core/time helpers unchanged. */
const HEADER_PX = 0;
/** Default length of a freshly-created block (one hour). */
const DEFAULT_BLOCK_MINUTES = 60;
/** Default length of a new subtask seeded inside its parent block. */
const DEFAULT_SUBTASK_MINUTES = 30;

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
  let startVal = kind === "plan" ? node.plannedStart : node.actualStart;
  let endVal = kind === "plan" ? node.plannedEnd : node.actualEnd;
  // Action column: when no actual is recorded yet, fall back to the plan span so
  // a faint "ghost" placeholder shows on the right automatically. Dragging it
  // writes the actual fields (see handleDragEnd), turning the ghost real.
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
      title: "",
      type: "task",
      ...(kind === "plan"
        ? { plannedStart: start, plannedEnd: end }
        : { actualStart: start, actualEnd: end }),
    });
  };

  /**
   * Create a child node nested inside `parent` for this column (frame-in-frame).
   * The child's type is one level deeper (`childTypeOf`) and its seed span is the
   * first slice of the parent's range, clamped to stay inside it. Optimistic via
   * `useAddNode`; if subtasks grow past the parent, the parent block auto-expands
   * to wrap them at render time (`fitParentToChildren`).
   */
  const addSubtask = (parent: FlatNode, kind: ColumnKind) => {
    const base = readSpan(parent, kind);
    if (!base) return;
    // Stack the new subtask *after* existing siblings (their max end), so each
    // one appends below the previous instead of overlapping at the parent start.
    // If it runs past the parent, the parent auto-expands at render time
    // (fitParentToChildren) — that overflow is the "this is really a subproject"
    // signal, so we don't clamp it back inside the parent.
    let start = base.start;
    for (const sib of all) {
      if (sib.parentId !== parent.id) continue;
      const sp = readSpan(sib, kind);
      if (sp && sp.end.getTime() > start.getTime()) start = sp.end;
    }
    const seed = { start, end: addMinutes(start, DEFAULT_SUBTASK_MINUTES) };
    addNode.mutate({
      title: "",
      type: childTypeOf(parent.type),
      parentId: parent.id,
      ...(kind === "plan"
        ? { plannedStart: seed.start, plannedEnd: seed.end }
        : { actualStart: seed.start, actualEnd: seed.end }),
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

    // The dragged block's own new span (move shifts both edges, resize the end).
    const ownSpan =
      data.mode === "move"
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
      const parent = visibleParent(current, data.column);

      // resize only ever moves the dragged block's own end; every other write —
      // a clamped move, or a grown ancestor whose start and/or end shifted — is a
      // whole-span move.
      const writeWholeSpan = !(isDraggedNode && data.mode === "resize");

      if (!parent) {
        patches.push({
          id: current.id,
          patch: writeWholeSpan
            ? movePatch(data.column, currentSpan)
            : resizePatch(data.column, currentSpan),
        });
        break;
      }

      const parentBase = readSpan(parent, data.column)!;
      const grown = fitParentToChildren(parentBase, [currentSpan]);
      // Keep this level inside its parent. Once the parent has grown to wrap an
      // overflowing child this is a no-op; it guards the child ⊆ parent invariant.
      const clamped = clampChildToParent(currentSpan, grown);
      patches.push({
        id: current.id,
        patch: writeWholeSpan
          ? movePatch(data.column, clamped)
          : resizePatch(data.column, clamped),
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

      {buildColumnTree(kind).map((block) => (
        <CalendarBlock
          key={block.node.id}
          block={block}
          column={kind}
          depth={0}
          pxPerMinute={PX_PER_MINUTE}
          headerPx={HEADER_PX}
          style={{
            top: blockTopMinutes(block.span.start) * PX_PER_MINUTE,
            height: blockPixelHeight(block, PX_PER_MINUTE, HEADER_PX),
          }}
          onAddSubtask={(parent) => addSubtask(parent, kind)}
        />
      ))}
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
