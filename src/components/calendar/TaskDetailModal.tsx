"use client";

import { useEffect, useRef, useState } from "react";
import { MiniCalendar } from "@/components/MiniCalendar";
import { useSelectedDate } from "@/components/date";
import { dayFromKey, dayKey } from "@/core/time/day";
import {
  type ActionEdit,
  type PlanEdit,
  barStartDay,
  setDoneDay,
  setOriginalDay,
} from "@/core/time/span";
import {
  useActionBlocks,
  useAddActionBlock,
  useUpdateActionBlock,
} from "@/hooks/actionBlocks";
import {
  useAddPlanBlock,
  usePlanBlocks,
  useRemovePlanBlock,
  useUpdatePlanBlock,
} from "@/hooks/planBlocks";
import { useProjects } from "@/hooks/projects";
import { useTasks, useUpdateTask } from "@/hooks/tasks";
import { useTranslations } from "next-intl";

/**
 * The detail card for a single `task` — the *bar* editor (the user's mental
 * model: a task is one multi-day event, like a Google-Calendar event spanning
 * days). It edits two ends:
 *  - **Originally** — the day it was first planned (the bar's left end).
 *  - **Done**       — the day it was actually done (the bar's right end); picking
 *    a day creates the action if the task wasn't done yet.
 *
 * Moving either end runs the pure `setOriginalDay` / `setDoneDay` (core/time/span)
 * which returns the row edits — and applying them refills/trims the `missed`
 * middle so the calendar blocks always match the bar (the same optimistic hooks
 * the drag uses, so the grid updates instantly). **Carried** is the read-only
 * missed-day count (the quiet subproject signal). Text fields flush on blur AND
 * on close. All date math lives in `core/time`.
 */

/** HH:MM from an ISO timestamp (local time). */
const fmtTime = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

/** Display-only date formatting — locale-independent (OS-agnostic). */
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const fmtDate = (d: Date) =>
  `${WEEKDAYS[d.getDay()]} ${MONTHS[d.getMonth()]} ${d.getDate()}`;

export function TaskDetailModal({
  taskId,
  onClose,
}: {
  taskId: string;
  onClose: () => void;
}) {
  const { selectedDate } = useSelectedDate();
  const { data: allTasks } = useTasks();
  const { data: allPlans } = usePlanBlocks();
  const { data: allActions } = useActionBlocks();
  const { data: projectData } = useProjects();

  const t = useTranslations("taskDetail");
  const updateTask = useUpdateTask();
  const addPlan = useAddPlanBlock();
  const updatePlan = useUpdatePlanBlock();
  const removePlan = useRemovePlanBlock();
  const addAction = useAddActionBlock();
  const updateAction = useUpdateActionBlock();

  const titleRef = useRef<HTMLTextAreaElement>(null);
  const notesRef = useRef<HTMLTextAreaElement>(null);
  const categoryRef = useRef<HTMLInputElement>(null);

  // Which date row's mini-calendar is open ("originally" | "done" | null).
  const [openCal, setOpenCal] = useState<"originally" | "done" | null>(null);

  const task = allTasks?.find((t) => t.taskId === taskId) ?? null;

  // Commit the task's text fields (uncontrolled → read live DOM, changed only).
  const commitText = () => {
    if (!task) return;
    const patch: Partial<typeof task> = {};
    const title = titleRef.current?.value.trim() ?? "";
    if (title !== task.title) patch.title = title;
    const rawNotes = notesRef.current?.value ?? "";
    const notes = rawNotes.length ? rawNotes : null;
    if (notes !== (task.notes ?? null)) patch.notes = notes;
    const rawCategory = categoryRef.current?.value.trim() ?? "";
    const category = rawCategory.length ? rawCategory : null;
    if (category !== (task.category ?? null)) patch.category = category;
    if (Object.keys(patch).length) updateTask.mutate({ taskId, patch });
  };

  const close = () => {
    commitText();
    onClose();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    titleRef.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!task) return null; // deleted elsewhere — nothing to edit (after hooks)

  const projects = (projectData ?? [])
    .slice()
    .sort(
      (a, b) =>
        new Date(a.createdOn).getTime() - new Date(b.createdOn).getTime(),
    );

  const taskPlans = (allPlans ?? []).filter((p) => p.taskId === taskId);
  const taskActions = (allActions ?? []).filter((a) => a.taskId === taskId);
  // The representative action is the latest one (a task is done once).
  const liveAction =
    taskActions
      .slice()
      .sort((a, b) => b.startAt.localeCompare(a.startAt))[0] ?? null;
  const carryCount = taskPlans.filter((p) => p.status === "missed").length;

  // Apply the row edits returned by the pure bar functions, optimistically.
  // Order (delete → update → insert) is incidental: each is an independent cache
  // write on a distinct row, batched into one frame by React.
  const applyPlanEdit = (edit: PlanEdit) => {
    edit.deletes.forEach((id) => removePlan.mutate(id));
    edit.updates.forEach((u) => updatePlan.mutate(u));
    edit.inserts.forEach((row) => addPlan.mutate(row));
  };
  const applyActionEdit = (edit: ActionEdit | null) => {
    if (!edit) return;
    if (edit.kind === "update")
      updateAction.mutate({
        actionBlockId: edit.actionBlockId,
        patch: edit.patch,
      });
    else addAction.mutate(edit.row);
  };

  // Move the bar's left end (originally planned) to the picked day.
  const changeOriginally = (picked: Date) => {
    applyPlanEdit(setOriginalDay(taskPlans, taskId, dayKey(picked), liveAction));
    setOpenCal(null);
  };
  // Move the bar's right end (done) — refills the middle and moves/creates the action.
  const changeDone = (picked: Date) => {
    const { plan, action } = setDoneDay(
      taskPlans,
      liveAction,
      taskId,
      dayKey(picked),
    );
    applyPlanEdit(plan);
    applyActionEdit(action);
    setOpenCal(null);
  };

  const originallyKey = barStartDay(taskPlans);
  const originallyDate = originallyKey ? dayFromKey(originallyKey) : null;
  const doneDate = liveAction ? dayFromKey(liveAction.date) : null;

  // Plan and action times for the currently viewed date.
  const viewDateKey = dayKey(selectedDate);
  const viewPlan = taskPlans.find(
    (p) => p.date === viewDateKey && p.status !== "missed",
  ) ?? null;
  const viewAction = taskActions.find((a) => a.date === viewDateKey) ?? null;

  const rowLabel = "w-24 shrink-0 text-sm text-muted";
  const dateBtn =
    "rounded-md border border-border bg-transparent px-2 py-1 text-sm text-foreground hover:border-accent/60 focus:outline-none focus:ring-1 focus:ring-accent/40";

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
        aria-label={t("modalLabel")}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-xl border border-border bg-panel shadow-lg"
      >
        {/* Header: title + close */}
        <div className="flex items-start justify-between gap-2 p-4 pb-3">
          <textarea
            ref={titleRef}
            defaultValue={task.title}
            placeholder={t("titlePlaceholder")}
            onBlur={commitText}
            rows={1}
            aria-label={t("titleLabel")}
            className="min-h-0 flex-1 resize-none break-words [field-sizing:content] bg-transparent text-base font-medium leading-tight text-foreground placeholder:font-normal placeholder:text-muted focus:outline-none"
          />
          <button
            type="button"
            onClick={close}
            aria-label={t("close")}
            title={t("close")}
            className="shrink-0 rounded-md px-1 text-muted transition-colors hover:bg-accent-soft hover:text-foreground"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-4">
          <textarea
            ref={notesRef}
            defaultValue={task.notes ?? ""}
            placeholder={t("notesPlaceholder")}
            onBlur={commitText}
            rows={2}
            aria-label={t("notesLabel")}
            className="mb-3 w-full resize-none rounded-md border border-border bg-transparent p-2 text-sm leading-snug text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent/40"
          />

          <div className="mb-4 flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <span className="text-muted">{t("categoryLabel")}</span>
              <input
                ref={categoryRef}
                defaultValue={task.category ?? ""}
                placeholder="—"
                onBlur={commitText}
                aria-label={t("categoryInputLabel")}
                className="w-28 rounded-md border border-border bg-transparent px-2 py-1 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent/40"
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <span className="text-muted">{t("projectLabel")}</span>
              <select
                value={task.projectId ?? ""}
                onChange={(e) =>
                  updateTask.mutate({
                    taskId,
                    patch: { projectId: e.target.value || null },
                  })
                }
                aria-label={t("projectLabel")}
                className="rounded-md border border-border bg-transparent px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent/40"
              >
                <option value="">{t("noProject")}</option>
                {projects.map((p) => (
                  <option key={p.projectId} value={p.projectId}>
                    {p.title || t("projectFallback")}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {/* The bar's two ends — editing one moves the calendar block(s). */}
          <div className="flex flex-col gap-2 border-t border-border pt-3">
            {/* Originally — the left end (first planned day) */}
            <div>
              <div className="flex items-center">
                <span className={rowLabel}>{t("originally")}</span>
                {originallyDate ? (
                  <button
                    type="button"
                    onClick={() =>
                      setOpenCal((c) => (c === "originally" ? null : "originally"))
                    }
                    className={dateBtn}
                    title={t("movePlannedDay")}
                  >
                    {fmtDate(originallyDate)}
                  </button>
                ) : (
                  <span className="text-sm text-muted">—</span>
                )}
              </div>
              {openCal === "originally" && originallyDate && (
                <div className="mt-2 pl-24">
                  <MiniCalendar
                    selected={originallyDate}
                    onSelect={changeOriginally}
                  />
                </div>
              )}
            </div>

            {/* Done — the right end (actually done day) */}
            <div>
              <div className="flex items-center">
                <span className={rowLabel}>{t("done")}</span>
                {doneDate ? (
                  <button
                    type="button"
                    onClick={() => setOpenCal((c) => (c === "done" ? null : "done"))}
                    className={dateBtn}
                    title={t("moveDoneDay")}
                  >
                    {fmtDate(doneDate)}
                  </button>
                ) : originallyDate ? (
                  <button
                    type="button"
                    onClick={() => setOpenCal((c) => (c === "done" ? null : "done"))}
                    className={`${dateBtn} text-muted`}
                    title={t("markDoneDay")}
                  >
                    {t("notDone")}
                  </button>
                ) : (
                  <span className="text-sm text-muted">—</span>
                )}
              </div>
              {openCal === "done" && (originallyDate || doneDate) && (
                <div className="mt-2 pl-24">
                  <MiniCalendar
                    selected={doneDate ?? originallyDate ?? new Date()}
                    onSelect={changeDone}
                  />
                </div>
              )}
            </div>

            {/* Carried — read-only subproject signal */}
            {carryCount >= 1 && (
              <div className="flex items-center">
                <span className={rowLabel}>{t("carried")}</span>
                <span
                  className={`text-sm tabular-nums ${
                    carryCount >= 4 ? "text-amber-600" : "text-foreground"
                  }`}
                  title={t("carriedTitle")}
                >
                  {carryCount}×
                </span>
              </div>
            )}

            {/* Plan / Action times for the currently viewed date */}
            {(viewPlan || viewAction) && (
              <>
                <div className="my-1 border-t border-border" />
                {viewPlan && (
                  <div className="flex items-center">
                    <span className={rowLabel}>{t("planTime")}</span>
                    <span className="text-sm tabular-nums text-foreground">
                      {fmtTime(viewPlan.startAt)}
                      {viewPlan.endAt ? ` – ${fmtTime(viewPlan.endAt)}` : ""}
                    </span>
                  </div>
                )}
                {viewAction && (
                  <div className="flex items-center">
                    <span className={rowLabel}>{t("actionTime")}</span>
                    <span className="text-sm tabular-nums text-foreground">
                      {fmtTime(viewAction.startAt)}
                      {viewAction.endAt ? ` – ${fmtTime(viewAction.endAt)}` : ""}
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
