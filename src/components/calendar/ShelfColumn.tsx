"use client";

import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowRotateLeft, faBoxArchive, faXmark } from "@fortawesome/free-solid-svg-icons";
import { useTranslations } from "next-intl";
import { isShelved } from "@/core/time/shelf";
import { projectColor } from "@/lib/projectColor";
import { TaskDetailModal } from "@/components/calendar/TaskDetailModal";
import { useProjects } from "@/hooks/projects";
import { useShelf } from "@/hooks/shelf";
import { useTasks, useRemoveTask } from "@/hooks/tasks";

/**
 * The Shelf (ADR-026): a visible bucket where intentionally-parked tasks wait.
 * This app has no task-list UI — tasks live only as calendar blocks — so a
 * shelved task would vanish without this list. A task lands here via a block's
 * shelve button (or, on desktop, by dragging a block onto it) and leaves by
 * "bring back" (un-shelve → a fresh plan on today) or by being dragged back onto
 * the calendar. It has no time axis — order is by shelved time, newest first.
 *
 * Self-contained: it renders its own header (title + count) and opens its own
 * detail modal, so it drops into either the desktop left rail or the mobile tab
 * unchanged. Drag wiring is layered on by the grid.
 */
export function ShelfColumn({ className }: { className?: string }) {
  const t = useTranslations("shelf");
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);
  const { data: taskData } = useTasks();
  const { data: projectData } = useProjects();
  const { unshelve } = useShelf();
  const removeTask = useRemoveTask();

  const projectById = new Map((projectData ?? []).map((p) => [p.projectId, p]));
  const shelved = (taskData ?? [])
    .filter(isShelved)
    .sort((a, b) =>
      String(b.shelvedAt ?? "").localeCompare(String(a.shelvedAt ?? "")),
    );

  const dotColor = (projectId: string | null): string | undefined =>
    (projectId && projectById.get(projectId)?.projectColor) ||
    projectColor(projectId) ||
    undefined;

  return (
    <div className={`flex min-h-0 flex-col ${className ?? ""}`}>
      <div className="mb-3 flex items-baseline gap-1.5">
        <h2 className="text-base font-semibold tracking-tight text-foreground">
          <FontAwesomeIcon icon={faBoxArchive} className="mr-1.5 text-sm text-accent" />
          {t("title")}
        </h2>
        {shelved.length > 0 && (
          <span className="text-xs tabular-nums text-muted">{shelved.length}</span>
        )}
      </div>

      {shelved.length > 0 && (
        <ul className="flex min-h-0 flex-col gap-1.5 overflow-y-auto pr-0.5">
          {shelved.map((task) => (
            <li
              key={task.taskId}
              className="group/chip flex items-center gap-2 rounded-md border border-border bg-background px-2 py-1.5 shadow-sm"
            >
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: dotColor(task.projectId) }}
                aria-hidden
              />
              <button
                type="button"
                onClick={() => setDetailTaskId(task.taskId)}
                className="min-w-0 flex-1 truncate text-left text-xs font-medium text-foreground hover:text-accent"
                title={task.title || t("untitled")}
              >
                {task.title || (
                  <span className="font-normal text-muted">{t("untitled")}</span>
                )}
              </button>
              <button
                type="button"
                onClick={() => unshelve(task.taskId)}
                aria-label={t("bringBack")}
                title={t("bringBack")}
                className="shrink-0 text-[10px] text-muted opacity-0 transition-opacity hover:text-accent group-hover/chip:opacity-100"
              >
                <FontAwesomeIcon icon={faArrowRotateLeft} />
              </button>
              <button
                type="button"
                onClick={() => removeTask.mutate(task.taskId)}
                aria-label={t("delete")}
                title={t("delete")}
                className="shrink-0 text-[10px] text-muted opacity-0 transition-opacity hover:text-red-500 group-hover/chip:opacity-100"
              >
                <FontAwesomeIcon icon={faXmark} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {detailTaskId && (
        <TaskDetailModal
          taskId={detailTaskId}
          onClose={() => setDetailTaskId(null)}
        />
      )}
    </div>
  );
}
