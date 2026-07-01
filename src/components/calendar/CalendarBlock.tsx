"use client";

import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faMaximize,
  faXmark,
  faCircleArrowRight,
  faBoxArchive,
} from "@fortawesome/free-solid-svg-icons";
import type { Span } from "@/core/time/calendar";
import { useProjects } from "@/hooks/projects";
import { useUpdateTask } from "@/hooks/tasks";
import { useShelf } from "@/hooks/shelf";
import { useRemovePlanBlock } from "@/hooks/planBlocks";
import { useRemoveActionBlock } from "@/hooks/actionBlocks";
import { useTranslations } from "next-intl";

/** Which list a column reads/writes (ADR-017 PLAN vs. ACT). */
export type ColumnKind = "plan" | "action";

/** Move shifts the whole block in time; resize-start/resize drag the top or bottom edge. */
export type DragMode = "move" | "resize-start" | "resize";

/**
 * One block drawn on a calendar column (ADR-016/017). A PLAN-column block is a
 * `plan_block`; an ACT-column block is either a real `action_block` or a *ghost*
 * — a faint projection of an unacted plan, clicked to spawn an action at that
 * time. `blockId` is the row this block stands for (the drag/resize/delete
 * target): a `planBlockId` for plan/ghost, an `actionBlockId` for a real action.
 * `taskId` carries the identity (title edits + project assignment go to the
 * task); `color` is the task's project colour (null = unassigned → white block).
 * `isOngoing` is the *doing* highlight (now within an action span, derived).
 * `carryCount` is the task's missed-plan count, shown as the quiet `·N` badge.
 */
export type CalBlock = {
  kind: ColumnKind;
  blockId: string;
  taskId: string;
  title: string;
  span: Span;
  color: string | null;
  projectId: string | null;
  /** ACT-column ghost: drawn from a plan span, no action recorded yet. */
  isGhost?: boolean;
  /** PLAN-column plan carried away (status `missed`) — drawn dashed. */
  isMissed?: boolean;
  /** Action spanning now → the in-progress highlight (ADR-017). */
  isOngoing?: boolean;
  /** ACT-column action with status `partial` — user will continue tomorrow. */
  isPartial?: boolean;
  /** How many times the owning task was carried (count of missed plans). */
  carryCount: number;
};

/**
 * A block drawn as an absolutely-positioned box on a calendar column. Tinted with
 * its project colour (white when unassigned); the title **wraps inside it** — no
 * header band. A small control row (project swatch → assign menu, delete) sits on
 * top and is the drag handle; the bottom edge drags to resize. Title edits and
 * project assignment belong to the task (`useUpdateTask`); span moves go through
 * the optimistic plan/action update hooks (owned by the grid). Delete: a PLAN ✕
 * drops the plan; a real ACT ✕ drops only the action (its plan survives and
 * re-appears as a ghost). A *ghost* ✕ is not a delete — it carries the plan to the
 * next day (`onCarryOver`): "I won't get to this today".
 *
 * A *ghost* has no drag handle and no inline title — clicking its body spawns the
 * action (the grid's `onConfirm`), while its ✕ carries the plan forward. The title
 * is edited on the PLAN side instead. Dragging is plain pointer events (no dnd-kit,
 * which fought
 * our live re-layout): the control row starts a move, the bottom edge a resize,
 * and the grid tracks the pointer on `window`. Only vertical (time) movement is
 * meaningful — overlapping blocks self-arrange by start time (no manual reorder).
 */
export function CalendarBlock({
  block,
  style,
  onConfirm,
  onCarryOver,
  onOpenDetail,
  onContinueTomorrow,
  onDragStart,
  isDragging,
}: {
  block: CalBlock;
  /** Absolute pixel position/size of this block within the grid column. */
  style: React.CSSProperties;
  /** Click-to-create for a ghost (undefined for real blocks). */
  onConfirm?: () => void;
  /** Carry this ghost's plan to the next day (manual carry-over, ghost only). */
  onCarryOver?: () => void;
  /** Open the owning task's detail modal (title/notes/plans/actions). */
  onOpenDetail?: () => void;
  /** Mark this action partial and create a plan for tomorrow (action only). */
  onContinueTomorrow?: () => void;
  /** Begin a pointer drag (move/resize) — the grid owns the drag state. */
  onDragStart: (
    blockId: string,
    kind: ColumnKind,
    mode: DragMode,
    clientY: number,
  ) => void;
  /** True while this block is the active drag target (drives the highlight). */
  isDragging: boolean;
}) {
  const {
    kind,
    blockId,
    taskId,
    title,
    color,
    projectId,
    isGhost,
    isMissed,
    isOngoing,
    isPartial,
    carryCount,
  } = block;
  const t = useTranslations("block");
  // Inline title editing: off by default so the title is a static, draggable
  // surface (press-and-drag moves the block, even on a long wrapped title).
  // A double-click flips it on, turning the title into a focused textarea.
  const [editing, setEditing] = useState(false);
  const updateTask = useUpdateTask();
  const { shelve } = useShelf();
  const removePlanBlock = useRemovePlanBlock();
  const removeActionBlock = useRemoveActionBlock();

  // Projects for the assign menu — assigning sets the task's projectId (and so
  // the colour it inherits). Membership is a property of the task, not the block.
  const { data: projectData } = useProjects();
  const projects = (projectData ?? [])
    .slice()
    .sort(
      (a, b) =>
        new Date(a.createdOn).getTime() - new Date(b.createdOn).getTime(),
    );

  const commitTitle = (value: string) => {
    const next = value.trim();
    if (next !== title) updateTask.mutate({ taskId, patch: { title: next } });
  };

  // A real block's ✕ deletes its own row: PLAN ✕ removes the plan, ACT ✕ removes
  // only the action (its plan survives → re-appears as a ghost). A *ghost* ✕ is
  // not a delete — it carries the plan to the next day (onCarryOver): "I won't get
  // to this today", so the work is rescheduled, not lost (ADR-017).
  const remove = () => {
    if (kind === "plan") removePlanBlock.mutate(blockId);
    else removeActionBlock.mutate(blockId);
  };

  // Tinted with the project colour; white when no project is assigned.
  const tintStyle = color
    ? { backgroundColor: `${color}26`, borderColor: `${color}66` }
    : undefined;

  // Missed plans get a red border + diagonal hatch overlay.
  const missedStyle = isMissed
    ? {
        borderColor: "rgb(239 68 68 / 0.55)",
        backgroundImage:
          "repeating-linear-gradient(135deg, transparent, transparent 5px, rgb(239 68 68 / 0.09) 5px, rgb(239 68 68 / 0.09) 8px)",
      }
    : undefined;

  return (
    <div
      // A click on a ghost confirms it (spawns the action); a real block swallows
      // the click so it never reaches the grid (which would create a new block).
      onClick={(e) => {
        e.stopPropagation();
        onConfirm?.();
      }}
      // Double-click a real block to edit its title inline (the title turns into
      // a focused textarea). A single click/drag stays free for moving the block,
      // so a long title no longer eats the drag surface. Ghosts are skipped (their
      // single-click spawns an action; the title is edited on the PLAN side). The
      // detail modal moved to the ⤢ button so double-click can own title editing.
      onDoubleClick={(e) => {
        if (isGhost || editing) return;
        e.stopPropagation();
        setEditing(true);
      }}
      style={{
        ...style,
        ...tintStyle,
        ...missedStyle,
        ...(isPartial ? { borderBottomStyle: "dashed" } : {}),
      }}
      className={`group absolute flex select-none flex-col gap-0.5 overflow-hidden rounded-md border p-1 shadow-sm transition-shadow ${
        color ? "" : "border-accent/50 bg-accent-soft"
      } ${
        isDragging ? "z-10 border-accent/60 shadow-md ring-1 ring-accent/40" : ""
      } ${isOngoing ? "ring-2 ring-accent/60" : ""} ${
        isGhost
          ? "border-dashed opacity-60"
          : isMissed
            ? "opacity-75"
            : ""
      }`}
    >
      {/* Control row — also the drag handle (press and drag to move in time). */}
      <div
        onPointerDown={(e) => {
          if (isGhost) return; // ghost: click-to-create only, never dragged
          if (e.button !== 0) return;
          e.preventDefault();
          onDragStart(blockId, kind, "move", e.clientY);
        }}
        className={`flex flex-1 items-start gap-1 ${
          isGhost ? "" : "cursor-grab active:cursor-grabbing"
        }`}
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
          {!isGhost && (
            <select
              value={projectId ?? ""}
              onChange={(e) =>
                updateTask.mutate({
                  taskId,
                  patch: { projectId: e.target.value || null },
                })
              }
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              aria-label={t("assignProject")}
              title={t("assignProject")}
              className="absolute inset-0 cursor-pointer opacity-0"
            >
              <option value="">{t("noProject")}</option>
              {projects.map((p) => (
                <option key={p.projectId} value={p.projectId}>
                  {p.title || t("projectFallback")}
                </option>
              ))}
            </select>
          )}
        </span>

        {/* Title. A ghost is always static (edit on PLAN). A real block is static
            until double-clicked: as a plain div its pointer-down bubbles to the
            control row and starts a move, so the whole title is a drag surface.
            Double-click flips `editing` on and swaps in a focused textarea. */}
        {isGhost ? (
          <span className="min-h-0 min-w-0 flex-1 break-words text-xs font-medium leading-tight text-foreground">
            {title || <span className="font-normal text-muted">{t("newTask")}</span>}
          </span>
        ) : editing ? (
          <textarea
            defaultValue={title}
            placeholder={t("newTask")}
            autoFocus
            // Caret to the end on focus (rename-friendly), not a select-all.
            onFocus={(e) => {
              const v = e.currentTarget.value;
              e.currentTarget.setSelectionRange(v.length, v.length);
            }}
            // Blur commits; Shift+Enter also commits; Escape reverts.
            onBlur={(e) => {
              commitTitle(e.target.value);
              setEditing(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && e.shiftKey) {
                e.preventDefault();
                e.currentTarget.blur();
              } else if (e.key === "Escape") {
                e.preventDefault();
                // Revert before blurring so the commit on blur is a no-op.
                e.currentTarget.value = title;
                e.currentTarget.blur();
              }
              // Plain Enter falls through → textarea inserts a newline naturally.
            }}
            onClick={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            aria-label={t("titleLabel")}
            rows={1}
            // field-sizing:content grows to fit wrapped lines; the block's own
            // overflow-hidden crops it once it exceeds the box. overflow-hidden
            // here also kills the textarea's own scrollbar, which otherwise
            // appears when a font's line metrics overflow the box by a hair.
            className="min-h-0 min-w-0 flex-1 resize-none overflow-hidden break-words [field-sizing:content] bg-transparent text-xs font-medium leading-tight text-foreground placeholder:font-normal placeholder:text-muted focus:outline-none"
          />
        ) : (
          <div
            className={`min-h-0 min-w-0 flex-1 whitespace-pre-line break-words text-xs font-medium leading-tight text-foreground ${isMissed ? "line-through" : ""}`}
          >
            {title || <span className="font-normal text-muted">{t("newTask")}</span>}
          </div>
        )}

        {/* carryCount badge: hidden at 0–1, muted `·N` at 2–3, amber at 4+
            (ADR-017 — a quiet subproject signal that only grows loud when it
            has been carried too many times). */}
        {carryCount >= 2 && (
          <span
            className={`shrink-0 text-[10px] tabular-nums ${
              carryCount >= 4 ? "text-amber-600" : "text-muted"
            }`}
            title={t("carriedOver", { count: carryCount })}
          >
            ·{carryCount}
          </span>
        )}

        {/* Detail button — opens task detail modal. Real blocks only. */}
        {!isGhost && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenDetail?.();
            }}
            onPointerDown={(e) => e.stopPropagation()}
            aria-label={t("openDetail")}
            title={t("openDetail")}
            className="shrink-0 text-[10px] text-muted opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
          >
            <FontAwesomeIcon icon={faMaximize} />
          </button>
        )}

        {/* Delete / carry-over button. Ghost: carry plan to next day. Real: delete row. */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (isGhost) onCarryOver?.();
            else remove();
          }}
          onPointerDown={(e) => e.stopPropagation()}
          aria-label={
            isGhost
              ? t("carryOverToNext")
              : kind === "action"
                ? t("deleteAction")
                : t("deletePlan")
          }
          title={
            isGhost
              ? t("carryOverToNext")
              : kind === "action"
                ? t("deleteAction")
                : t("deletePlan")
          }
          className={`shrink-0 text-[10px] text-muted opacity-0 transition-opacity group-hover:opacity-100 ${
            isGhost ? "hover:text-amber-600" : "hover:text-red-500"
          }`}
        >
          <FontAwesomeIcon icon={faXmark} />
        </button>
      </div>

      {/* Continue tomorrow — action blocks only. Dashed bottom = already partial. */}
      {kind === "action" && !isGhost && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onContinueTomorrow?.();
          }}
          onPointerDown={(e) => e.stopPropagation()}
          aria-label={t("continueTomorrow")}
          title={t("continueTomorrow")}
          className={`absolute bottom-2 right-1 z-10 rounded text-[10px] transition-opacity ${
            isPartial
              ? "text-accent opacity-100"
              : "text-muted opacity-0 group-hover:opacity-100 hover:text-accent"
          }`}
        >
          <FontAwesomeIcon icon={faCircleArrowRight} />
        </button>
      )}

      {/* Shelve — bottom-left corner (real blocks only). Parks this task off the
          daily carry-over (ADR-026): it leaves the calendar and waits in the
          Shelf column. z-10 keeps it clickable above a long wrapped title. */}
      {!isGhost && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            shelve(taskId);
          }}
          onPointerDown={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
          aria-label={t("shelf")}
          title={t("shelf")}
          className="absolute bottom-2 left-1 z-10 rounded text-[10px] text-muted opacity-0 transition-opacity group-hover:opacity-100 hover:text-accent"
        >
          <FontAwesomeIcon icon={faBoxArchive} />
        </button>
      )}

      {/* Top edge — drag to resize the block's start time (real blocks only). */}
      {!isGhost && (
        <div
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            e.preventDefault();
            e.stopPropagation();
            onDragStart(blockId, kind, "resize-start", e.clientY);
          }}
          aria-label={t("resizeBlockStart")}
          className="absolute inset-x-0 top-0 h-2 cursor-ns-resize"
        />
      )}

      {/* Bottom edge — drag to resize the block's duration (real blocks only). */}
      {!isGhost && (
        <div
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            e.preventDefault();
            e.stopPropagation();
            onDragStart(blockId, kind, "resize", e.clientY);
          }}
          aria-label={t("resizeBlock")}
          className="absolute inset-x-0 bottom-0 h-2 cursor-ns-resize"
        />
      )}
    </div>
  );
}
