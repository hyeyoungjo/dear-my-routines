"use client";

import { useEffect, useRef, useState } from "react";
import {
  DEFAULT_GRID_END_HOUR,
  DEFAULT_GRID_START_HOUR,
  DEFAULT_SNAP_MINUTES,
  blockPixelHeight,
  blockTopMinutes,
  gridSlots,
  layoutOverlaps,
  moveBlock,
  resizeBlockEnd,
  resizeBlockStart,
  slotDate,
  snapMinutes,
  snapToSlot,
  type Span,
} from "@/core/time/calendar";
import {
  carryCountUpTo,
  carryOverPlan,
  continueLaterSpan,
  planSpan,
  plansForDay,
} from "@/core/time/plan";
import { actionSpan, actionsForDay, isOngoing } from "@/core/time/action";
import { shiftSpanOntoGridDay } from "@/core/time/carry";
import { isShelved } from "@/core/time/shelf";
import { hiddenProjectIds, isBlockProjectHidden } from "@/core/project";
import { addDays, dayKey } from "@/core/time/day";
import { projectColor } from "@/lib/projectColor";
import {
  CalendarBlock,
  type CalBlock,
  type ColumnKind,
  type ContinueDest,
  type DragMode,
} from "@/components/calendar/CalendarBlock";
import { TaskDetailModal } from "@/components/calendar/TaskDetailModal";
import { ReviewColumn } from "@/components/calendar/ReviewColumn";
import { useSelectedDate } from "@/components/date";
import { usePlanBlocks, useAddPlanBlock, useUpdatePlanBlock } from "@/hooks/planBlocks";
import {
  useActionBlocks,
  useAddActionBlock,
  useUpdateActionBlock,
} from "@/hooks/actionBlocks";
import { useTasks, useCreateTaskWithBlock } from "@/hooks/tasks";
import { useProjects } from "@/hooks/projects";
import { useUserSettings } from "@/hooks/userSettings";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCalendarDay,
  faPersonRunning,
  faPenToSquare,
} from "@fortawesome/free-solid-svg-icons";
import { useTranslations } from "next-intl";

/** Pixel height of one hour row; the whole grid scales off this. */
const SLOT_HEIGHT = 48;

const TAB_COLOR: Record<"plan" | "action" | "review", string> = {
  plan:   "var(--tab-plan-fg)",
  action: "var(--tab-act-fg)",
  review: "var(--tab-reflect-fg)",
};
const PX_PER_MINUTE = SLOT_HEIGHT / 60;
/** Default length of a freshly-created block (one hour). */
const DEFAULT_BLOCK_MINUTES = 60;

/**
 * Live state of a vertical pointer drag. `startY` is the pointer y at press;
 * `deltaMinutes` is the snapped vertical move (drives the preview span). The
 * target is one block in `kind`'s column, keyed by `blockId` (a planBlockId for
 * PLAN, an actionBlockId for ACT). There is no horizontal axis — overlapping
 * blocks self-arrange by start time, so a drag only moves a block in time.
 */
type DragPreview = {
  kind: ColumnKind;
  blockId: string;
  mode: DragMode;
  startY: number;
  deltaMinutes: number;
};

/**
 * Two-column day view (07:00 → 02:00, PRD "예상 vs. 실제"): a PLAN column of
 * `plan_blocks` (intent) on the left and an ACT column of `action_blocks`
 * (reality) on the right, sharing one time axis so the same wall-clock time sits
 * at the same height in both (ADR-017). Plan and action are separate lists joined
 * by `taskId` — no single row holds a planned+actual pair, so the old "2h→9h"
 * comparison label is gone by construction.
 *
 * An unacted plan is also projected into the ACT column as a faint **ghost**;
 * clicking it spawns an `action_block` at the plan's time (then freely
 * dragged/resized). Clicking an empty slot creates a one-hour task there (a new
 * task + its first plan/action, optimistically). The block currently spanning now
 * gets the in-progress highlight (`isOngoing`, derived).
 *
 * Blocks drag to move and edge-drag to resize via plain pointer events (no drag
 * library — it fought our live re-layout). A press records the start y; the grid
 * tracks the pointer on `window`, converting the vertical delta to a snapped
 * minute delta (previewed live). On release it commits through the optimistic
 * plan/action update hooks, so the change shows instantly and rolls back on
 * failure (CLAUDE.md CRITICAL). All schedule math comes from `core/time`.
 */
export function CalendarGrid() {
  const t = useTranslations("calendar");
  const { data: planData, isLoading, isError } = usePlanBlocks();
  const { data: actionData } = useActionBlocks();
  const { data: taskData } = useTasks();
  const { data: projectData } = useProjects();
  const { data: userSettingsData } = useUserSettings();
  const { selectedDate } = useSelectedDate();

  const gridStartHour = userSettingsData?.gridStartTime ?? DEFAULT_GRID_START_HOUR;
  const gridEndHour = userSettingsData?.gridEndTime ?? DEFAULT_GRID_END_HOUR;
  const gridTotalMinutes = (gridEndHour - gridStartHour) * 60;
  // Block time unit (settings, ADR pending): how finely blocks snap when
  // dragged/resized/created, and (synced) their minimum length. The hourly
  // grid lines (`gridSlots` above) are drawn independently and always stay
  // hourly regardless of this setting.
  const blockSnapMinutes = userSettingsData?.blockSnapMinutes ?? DEFAULT_SNAP_MINUTES;
  const createTaskWithBlock = useCreateTaskWithBlock();
  const addPlanBlock = useAddPlanBlock();
  const addActionBlock = useAddActionBlock();
  const updatePlanBlock = useUpdatePlanBlock();
  const updateActionBlock = useUpdateActionBlock();
  const [drag, setDrag] = useState<DragPreview | null>(null);
  // The task whose detail modal is open (clicking a block's ⤢), null = closed.
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);
  // Mobile-only: which tab is active. Desktop always shows all three columns.
  const [activeTab, setActiveTab] = useState<"plan" | "action" | "review">(
    "plan",
  );
  // Mirror the latest drag so the window pointerup handler (registered once per
  // drag) can read the final deltas without re-subscribing on every move.
  const dragRef = useRef<DragPreview | null>(null);
  dragRef.current = drag;
  // Set true on release after a real (moved) drag, so the trailing click the
  // browser fires doesn't reach the grid and create a new task.
  const justDraggedRef = useRef(false);

  const slots = gridSlots(gridStartHour, gridEndHour);
  const bodyHeight = gridTotalMinutes * PX_PER_MINUTE;
  const [now, setNow] = useState(() => new Date());
  // Tick once per minute so the now-line stays accurate without a re-render storm.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);
  const allPlans = planData ?? [];
  const allActions = actionData ?? [];

  const allTasks = taskData ?? [];
  const allProjects = projectData ?? [];
  // Projects the user hid from the calendar (ADR-028) — a render-only filter, the
  // plan/action rows stay untouched (ADR-025 "data is fact, screen is reading").
  const hiddenSet = hiddenProjectIds(allProjects);

  // Index tasks/projects for the title + colour join, and group plans by task so
  // carryCount (count of missed plans) is one lookup per block.
  const taskById = new Map(allTasks.map((t) => [t.taskId, t]));
  const projectById = new Map(allProjects.map((p) => [p.projectId, p]));
  const plansByTask = new Map<string, typeof allPlans>();
  for (const p of allPlans) {
    const list = plansByTask.get(p.taskId) ?? [];
    list.push(p);
    plansByTask.set(p.taskId, list);
  }

  /** The task's project colour (explicit, else deterministic id fallback). */
  const colorOf = (projectId: string | null): string | null => {
    if (!projectId) return projectColor(null);
    const project = projectById.get(projectId);
    return project?.projectColor ?? projectColor(projectId);
  };

  const createAt = (offsetMinutes: number, kind: ColumnKind) => {
    const start = slotDate(selectedDate, offsetMinutes, gridStartHour);
    const end = slotDate(selectedDate, offsetMinutes + DEFAULT_BLOCK_MINUTES, gridStartHour);
    const span = {
      date: dayKey(selectedDate),
      startAt: start.toISOString(),
      endAt: end.toISOString(),
    };
    // A new task + its first block under ONE client-minted taskId, created
    // together (one optimistic write, one transactional round-trip). Because the
    // client owns the id, the block renders this frame — no waiting for a
    // server-assigned task id (ADR-007, CLAUDE.md CRITICAL).
    createTaskWithBlock.mutate({
      taskId: crypto.randomUUID(),
      title: "",
      ...(kind === "plan" ? { plan: span } : { action: span }),
    });
  };

  /**
   * Confirm a ghost: spawn an action at the plan's exact time (ADR-017). No
   * justDragged guard here — a ghost can't be dragged (its pointerDown is a
   * no-op), so a click on it is never a drag's trailing click; it's always a real
   * confirm. (Guarding here was a bug: after dragging ANY block, justDragged
   * stayed true until an empty-slot click, silently swallowing ghost clicks.)
   */
  const confirmGhost = (block: CalBlock) => {
    addActionBlock.mutate({
      taskId: block.taskId,
      date: dayKey(selectedDate),
      startAt: block.span.start.toISOString(),
      endAt: block.span.end.toISOString(),
    });
  };

  /**
   * The → button's single handler (ADR-027 matrix). Three destinations:
   *  - `today`: same-day continuation — a fresh block one gap after this block's
   *    END (`continueLaterSpan`, block-relative so it works from plan AND action
   *    columns). It lands in the SAME column as the source: an action continues
   *    as a new action, a plan / ghost as a new `planned` plan. The original is
   *    left untouched: same-day "continue" is additive, not a miss (no
   *    partial/missed tag).
   *  - `tomorrow` / `date`: the classic carry to a later day, only the target
   *    generalized. An ACTION becomes `partial` + gets a plan on the target day at
   *    the same clock time. A PLAN block / ghost carries its underlying plan
   *    (`carryOverPlan`): the original → `missed`, a new `planned` on the target.
   * All writes go through the optimistic hooks — the screen never waits (ADR-007).
   */
  const continueBlock = (block: CalBlock, dest: ContinueDest) => {
    if (dest.when === "today") {
      const { start, end } = continueLaterSpan(
        block.span.end,
        selectedDate,
        gridEndHour,
      );
      const payload = {
        taskId: block.taskId,
        date: dayKey(selectedDate),
        startAt: start.toISOString(),
        endAt: end.toISOString(),
      };
      // Continue in the SAME column as the source: an action block continues as
      // an action, a plan block / ghost continues as a plan. (A ghost is a
      // plan-side stand-in, so it stays on the plan side.)
      if (block.kind === "action" && !block.isGhost) {
        addActionBlock.mutate(payload);
      } else {
        addPlanBlock.mutate(payload);
      }
      return;
    }

    const target = dest.when === "date" ? dest.date : addDays(selectedDate, 1);

    if (block.kind === "action" && !block.isGhost) {
      updateActionBlock.mutate({
        actionBlockId: block.blockId,
        patch: { status: "partial" },
      });
      // Shift the span onto the target *grid day* (not just its calendar date):
      // on a cross-midnight grid a post-midnight block must land on the next
      // calendar date to stay in the target day's window, else it reappears on
      // the source day. This also preserves the exact duration across the shift.
      const { start, end } = shiftSpanOntoGridDay(
        block.span.start,
        block.span.end,
        target,
        gridEndHour,
      );
      addPlanBlock.mutate({
        taskId: block.taskId,
        date: dayKey(target),
        startAt: start.toISOString(),
        endAt: end!.toISOString(),
      });
      return;
    }

    // Plan block / ghost: carry the underlying plan to the target day.
    const plan = allPlans.find((p) => p.planBlockId === block.blockId);
    if (!plan) return;
    const { missedPatch, nextPlan } = carryOverPlan(plan, target, gridEndHour);
    updatePlanBlock.mutate({ planBlockId: plan.planBlockId, patch: missedPatch });
    addPlanBlock.mutate(nextPlan);
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
    // Measure the *clicked* column body via e.currentTarget — NOT a shared ref.
    // renderColumn is rendered twice (desktop + the display:none mobile copy) and
    // both attach the same planBodyRef/actionBodyRef, so the ref can resolve to
    // the hidden copy whose getBoundingClientRect() is all zeros. That made `y`
    // the full page-offset of the body (scroll-dependent), placing new blocks
    // hours below the click. currentTarget is always the visible body clicked.
    const y = e.clientY - e.currentTarget.getBoundingClientRect().top;
    createAt(snapToSlot(y / PX_PER_MINUTE, gridTotalMinutes, blockSnapMinutes), kind);
  };

  /** A block was pressed — begin tracking a vertical move/resize. */
  const handleDragStart = (
    blockId: string,
    kind: ColumnKind,
    mode: DragMode,
    clientY: number,
  ) => {
    setDrag({ kind, blockId, mode, startY: clientY, deltaMinutes: 0 });
  };

  /** Commit a finished drag `d`: a vertical span move (both edges) or resize. */
  const commitDrag = (d: DragPreview | null) => {
    if (!d || d.deltaMinutes === 0) return;
    const base = baseSpanOf(d.kind, d.blockId);
    if (!base) return;
    const span =
      d.mode === "move"
        ? moveBlock(base.start, base.end, d.deltaMinutes)
        : d.mode === "resize-start"
          ? resizeBlockStart(base.start, base.end, d.deltaMinutes, blockSnapMinutes)
          : resizeBlockEnd(base.start, base.end, d.deltaMinutes, blockSnapMinutes);
    const patch =
      d.mode === "move"
        ? { startAt: span.start.toISOString(), endAt: span.end.toISOString() }
        : d.mode === "resize-start"
          ? { startAt: span.start.toISOString() }
          : { endAt: span.end.toISOString() };
    // Optimistic — the screen never waits (ADR-007). Each list owns its own row.
    if (d.kind === "plan") {
      updatePlanBlock.mutate({ planBlockId: d.blockId, patch });
    } else {
      updateActionBlock.mutate({ actionBlockId: d.blockId, patch });
    }
  };

  /** The unedited span of a draggable block (real plan/action only). */
  const baseSpanOf = (kind: ColumnKind, blockId: string): Span | null => {
    if (kind === "plan") {
      const plan = allPlans.find((p) => p.planBlockId === blockId);
      return plan ? planSpan(plan) : null;
    }
    const action = allActions.find((a) => a.actionBlockId === blockId);
    return action ? actionSpan(action) : null;
  };

  // While a drag is active, track the pointer on `window` (so it keeps following
  // even if the cursor leaves the block) and commit on release. Registered once
  // per drag — keyed by the stable session fields, not the live delta.
  useEffect(() => {
    if (!drag) return;
    const onMove = (e: PointerEvent) => {
      setDrag((prev) => {
        if (!prev) return prev;
        const deltaMinutes = snapMinutes(
          (e.clientY - prev.startY) / PX_PER_MINUTE,
          blockSnapMinutes,
        );
        if (prev.deltaMinutes === deltaMinutes) return prev;
        return { ...prev, deltaMinutes };
      });
    };
    const onUp = () => {
      const d = dragRef.current;
      if (d && d.deltaMinutes !== 0) justDraggedRef.current = true;
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
  }, [drag?.blockId, drag?.mode, drag?.kind]);

  /** Apply the live drag/resize preview to a block's base span (same pure math
   *  the commit uses), else the base span unchanged. */
  const withPreview = (kind: ColumnKind, blockId: string, base: Span): Span => {
    if (!drag || drag.kind !== kind || drag.blockId !== blockId) return base;
    return drag.mode === "move"
      ? moveBlock(base.start, base.end, drag.deltaMinutes)
      : drag.mode === "resize-start"
        ? resizeBlockStart(base.start, base.end, drag.deltaMinutes, blockSnapMinutes)
        : resizeBlockEnd(base.start, base.end, drag.deltaMinutes, blockSnapMinutes);
  };

  /** Title/colour/carryCount join for a task, or null for an orphan block.
   * Returns null for a **shelved** task too (ADR-026): every block builder
   * (plan / action / ghost) skips on a null decorate, so shelving hides all of a
   * task's blocks at once — a render-only filter, the rows stay untouched.
   * `beforeDate` scopes the carry count: only missed plans *before* that date
   * are counted, so each day's badge reflects how many times the task was
   * carried to reach that specific day rather than the lifetime total. */
  const decorate = (taskId: string, beforeDate: string) => {
    const task = taskById.get(taskId);
    if (!task || isShelved(task)) return null;
    // Task's project hidden from the calendar → drop every block (plan/action/
    // ghost) at once, same skip-on-null path as shelving (ADR-028).
    if (isBlockProjectHidden(task.projectId, hiddenSet)) return null;
    return {
      title: task.title,
      projectId: task.projectId,
      color: colorOf(task.projectId),
      carryCount: carryCountUpTo(plansByTask.get(taskId) ?? [], beforeDate),
    };
  };

  /**
   * Build the flat list of blocks visible in a column for the selected grid day.
   * PLAN draws every plan; ACT draws every real action plus a ghost for each
   * unacted plan (a plan whose task has no action that day). Orphan blocks (task
   * missing) are skipped. The live drag preview is applied via `withPreview`.
   */
  const buildColumnBlocks = (kind: ColumnKind): CalBlock[] => {
    const result: CalBlock[] = [];
    if (kind === "plan") {
      // PLAN shows every plan that day — `planned` (solid) AND `missed` (hatched,
      // the "meant to, didn't" record kept for review). But a `missed` plan whose
      // task was actually DONE that day (an action exists) is not a "didn't":
      // completion is derived from the action, never a stored plan status
      // (ADR-017). So it renders as a normal block, not the failed/struck-through
      // style — the stale `missed` flag is reconciled against reality here.
      const actedTaskIds = new Set(
        actionsForDay(allActions, selectedDate, gridStartHour, gridEndHour).map(
          (a) => a.taskId,
        ),
      );
      for (const plan of plansForDay(allPlans, selectedDate, gridStartHour, gridEndHour)) {
        const d = decorate(plan.taskId, plan.date);
        if (!d) continue;
        result.push({
          kind: "plan",
          blockId: plan.planBlockId,
          taskId: plan.taskId,
          span: withPreview("plan", plan.planBlockId, planSpan(plan)),
          isMissed: plan.status === "missed" && !actedTaskIds.has(plan.taskId),
          ...d,
        });
      }
      return result;
    }

    const selectedDateKey = dayKey(selectedDate);
    const dayActions = actionsForDay(allActions, selectedDate, gridStartHour, gridEndHour);
    // taskId → the day's action spans, used to decide whether a given plan slot
    // was actually acted (time overlap) rather than "the task was acted somewhere".
    const actedSpansByTask = new Map<string, Span[]>();
    for (const action of dayActions) {
      const base = actionSpan(action);
      if (!base) continue; // running (no end) — nothing to draw yet
      const spans = actedSpansByTask.get(action.taskId);
      if (spans) spans.push(base);
      else actedSpansByTask.set(action.taskId, [base]);
      const d = decorate(action.taskId, selectedDateKey);
      if (!d) continue;
      result.push({
        kind: "action",
        blockId: action.actionBlockId,
        taskId: action.taskId,
        span: withPreview("action", action.actionBlockId, base),
        isOngoing: isOngoing(action, now),
        isPartial: action.status === "partial",
        ...d,
      });
    }
    // Ghosts: a planned slot with no action *in that slot yet*, projected faintly.
    // Ghosts project only `planned` plans (no action yet). A `missed` plan was
    // carried away — it leaves the ACT view and lives on as a dashed PLAN record,
    // so a ghost ✕ (carry-over → missed) makes the ghost disappear here at once.
    for (const plan of plansForDay(allPlans, selectedDate, gridStartHour, gridEndHour)) {
      if (plan.status !== "planned") continue;
      const span = planSpan(plan);
      // Skip the ghost only when an action overlaps THIS plan's slot — not merely
      // because the task was acted elsewhere that day. Keying on the whole task
      // erased a task's other unacted plan segments the instant one ghost was
      // confirmed (or a continue-later plan was added beside an already-done one).
      const acted = actedSpansByTask.get(plan.taskId);
      if (acted?.some((a) => span.start < a.end && a.start < span.end)) continue;
      const d = decorate(plan.taskId, plan.date);
      if (!d) continue;
      result.push({
        kind: "action",
        blockId: plan.planBlockId,
        taskId: plan.taskId,
        span,
        isGhost: true,
        ...d,
      });
    }
    return result;
  };

  // Current-time line, shared by every column body and the time axis so it reads
  // as one continuous line across Plan / axis / Act. null when now is off-grid.
  const nowLineTop = (() => {
    const mins = (now.getHours() - gridStartHour) * 60 + now.getMinutes();
    return mins < 0 || mins > gridTotalMinutes ? null : mins * PX_PER_MINUTE;
  })();
  const nowLine =
    nowLineTop === null ? null : (
      <div
        className="pointer-events-none absolute inset-x-0 z-10 h-px bg-accent"
        style={{ top: nowLineTop }}
      />
    );

  /** Render one column's grid body: hour lines, click-to-create, and blocks. */
  const renderColumn = (kind: ColumnKind) => (
    <div
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
        // time as overlaps change. Order is by start time only (no sortOrder) —
        // overlapping blocks self-arrange, no manual reorder.
        const colBlocks = buildColumnBlocks(kind);
        const layoutItems = colBlocks.map((b) => ({
          span: b.span,
          node: { sortOrder: 0 },
        }));
        const laid = layoutOverlaps(layoutItems);
        return colBlocks.map((block, i) => {
          const slot = laid.get(layoutItems[i]) ?? { col: 0, cols: 1 };
          const widthPct = 100 / slot.cols;
          const isDragging =
            drag != null && drag.kind === kind && drag.blockId === block.blockId;
          return (
            <CalendarBlock
              key={`${block.isGhost ? "g" : ""}${block.blockId}`}
              block={block}
              onConfirm={block.isGhost ? () => confirmGhost(block) : undefined}
              onOpenDetail={() => setDetailTaskId(block.taskId)}
              onContinue={(dest) => continueBlock(block, dest)}
              onDragStart={handleDragStart}
              isDragging={isDragging}
              style={{
                top: blockTopMinutes(block.span.start, gridStartHour) * PX_PER_MINUTE,
                height: blockPixelHeight(block, PX_PER_MINUTE),
                left: `calc(${slot.col * widthPct}% + 2px)`,
                width: `calc(${widthPct}% - 4px)`,
              }}
            />
          );
        });
      })()}

      {/* Current time indicator — only shown when now falls within the grid range. */}
      {nowLine}
    </div>
  );

  const timeAxis = (width: string) => (
    <div className={`relative ${width} shrink-0`} style={{ height: bodyHeight }}>
      {slots.map((slot) => (
        <span
          key={slot.offsetMinutes}
          className="absolute inset-x-0 -translate-y-1/2 text-center text-[10px] tabular-nums text-muted"
          style={{ top: slot.offsetMinutes * PX_PER_MINUTE }}
        >
          {slot.label}
        </span>
      ))}
      {/* Bridge the now-line across the axis so it connects Plan and Act. */}
      {nowLine}
    </div>
  );

  return (
    <div className="flex flex-col">
      {/*
       * Mobile: folder-tab bar. Sits ABOVE the panel (not inside it) so the
       * active tab can visually merge with the panel below — same bg-panel
       * background, -mb-px to cover the panel's top border, z-10 to layer above.
       * Inactive tabs use bg-background to appear "behind" the open folder.
       */}
      <div className="relative z-10 flex items-end gap-0.5 sm:hidden">
        {(["plan", "action", "review"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={activeTab === tab ? { color: TAB_COLOR[tab] } : undefined}
            className={[
              "flex-1 rounded-t-xl border-l border-r border-t border-border text-center text-sm font-semibold transition-colors",
              activeTab === tab
                ? "-mb-px bg-panel pb-2 pt-3"
                : "bg-background pb-2 pt-2 text-muted hover:text-foreground",
            ].join(" ")}
          >
            {t(tab)}
          </button>
        ))}
      </div>

      <section className="relative flex min-h-0 flex-col rounded-b-xl border border-border bg-panel p-5 sm:rounded-xl">
        {/* Desktop: column headers */}
        <div className="mb-4 hidden items-baseline sm:flex">
          <h2 className="flex-1 text-center text-base font-semibold tracking-tight text-foreground">
            <FontAwesomeIcon icon={faCalendarDay} className="mr-1.5 text-sm text-accent" />
            {t("plan")}
          </h2>
          <div className="w-14 shrink-0" aria-hidden />
          <h2 className="flex-1 text-center text-base font-semibold tracking-tight text-foreground">
            <FontAwesomeIcon icon={faPersonRunning} className="mr-1.5 text-sm text-accent" />
            {t("action")}
          </h2>
          <h2 className="flex-1 text-center text-base font-semibold tracking-tight text-foreground">
            <FontAwesomeIcon icon={faPenToSquare} className="mr-1.5 text-sm text-accent" />
            {t("review")}
          </h2>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted">{t("loading")}</p>
        ) : isError ? (
          <p className="text-sm text-red-500">{t("loadFailed")}</p>
        ) : (
          <>
            {/* Desktop: Plan / Act / Reflect */}
            <div className="hidden sm:flex">
              {renderColumn("plan")}
              {timeAxis("w-14")}
              {renderColumn("action")}
              <ReviewColumn />
            </div>

            {/* Mobile: single active tab */}
            <div className="sm:hidden">
              {(activeTab === "plan" || activeTab === "action") && (
                <div className="flex" style={{ height: bodyHeight }}>
                  {timeAxis("w-14")}
                  {renderColumn(activeTab)}
                </div>
              )}
              {activeTab === "review" && <ReviewColumn className="border-l-0" />}
            </div>
          </>
        )}

        {detailTaskId && (
          <TaskDetailModal
            taskId={detailTaskId}
            onClose={() => setDetailTaskId(null)}
          />
        )}
      </section>
    </div>
  );
}
