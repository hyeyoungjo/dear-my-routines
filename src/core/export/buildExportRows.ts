import type {
  ActionBlock,
  DailyReview,
  PlanBlock,
  Project,
  Task,
} from "@/db/schema";
import { carryCountOf } from "@/core/time/plan";
import type { CompletionStatus, ExportRow } from "./types";

export type ExportInput = {
  tasks: Task[];
  projects: Project[];
  planBlocks: PlanBlock[];
  actionBlocks: ActionBlock[];
  dailyReviews: DailyReview[];
  /** All plan_blocks for every task across all time — for carryCountOf. */
  allTaskPlanBlocks: PlanBlock[];
};

function toHHMM(ts: Date): string {
  const h = ts.getHours().toString().padStart(2, "0");
  const m = ts.getMinutes().toString().padStart(2, "0");
  return `${h}:${m}`;
}

function durationMin(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / 60000);
}

/** Convert a DB PlanBlock to the shape carryCountOf expects (ISO string timestamps). */
function toCoreBlock(
  p: PlanBlock,
): { planBlockId: string; taskId: string; date: string; startAt: string; endAt: string; status: "planned" | "missed" } {
  return {
    planBlockId: p.planBlockId,
    taskId: p.taskId,
    date: p.date,
    startAt: p.startAt instanceof Date ? p.startAt.toISOString() : String(p.startAt),
    endAt: p.endAt instanceof Date ? p.endAt.toISOString() : String(p.endAt),
    status: p.status,
  };
}

export function buildExportRows(input: ExportInput): ExportRow[] {
  const { tasks, projects, planBlocks, actionBlocks, dailyReviews, allTaskPlanBlocks } = input;

  // Lookup maps
  const projectById = new Map(projects.map((p) => [p.projectId, p]));
  const reviewByDate = new Map(dailyReviews.map((r) => [r.date, r]));

  // Group plan_blocks and action_blocks by taskId + date
  const plansByTaskDate = new Map<string, PlanBlock[]>();
  for (const pb of planBlocks) {
    const key = `${pb.taskId}|${pb.date}`;
    const arr = plansByTaskDate.get(key) ?? [];
    arr.push(pb);
    plansByTaskDate.set(key, arr);
  }

  const actionsByTaskDate = new Map<string, ActionBlock[]>();
  for (const ab of actionBlocks) {
    const key = `${ab.taskId}|${ab.date}`;
    const arr = actionsByTaskDate.get(key) ?? [];
    arr.push(ab);
    actionsByTaskDate.set(key, arr);
  }

  // All-plan-blocks lookup by taskId (for carryCountOf)
  const allPlansByTask = new Map<string, PlanBlock[]>();
  for (const pb of allTaskPlanBlocks) {
    const arr = allPlansByTask.get(pb.taskId) ?? [];
    arr.push(pb);
    allPlansByTask.set(pb.taskId, arr);
  }

  // Collect all unique date+task combinations
  const dateTaskPairs = new Set<string>();
  for (const pb of planBlocks) dateTaskPairs.add(`${pb.date}|${pb.taskId}`);
  for (const ab of actionBlocks) dateTaskPairs.add(`${ab.date}|${ab.taskId}`);

  const taskById = new Map(tasks.map((t) => [t.taskId, t]));

  const rows: ExportRow[] = [];

  for (const pair of dateTaskPairs) {
    const sepIdx = pair.indexOf("|");
    const date = pair.slice(0, sepIdx);
    const taskId = pair.slice(sepIdx + 1);

    const task = taskById.get(taskId);
    if (!task) continue;

    const project = task.projectId ? projectById.get(task.projectId) : undefined;
    const plansForCell = plansByTaskDate.get(`${taskId}|${date}`) ?? [];
    const actionsForCell = actionsByTaskDate.get(`${taskId}|${date}`) ?? [];

    const hasPlan = plansForCell.length > 0;
    const hasAction = actionsForCell.length > 0;

    // Pick the first plan and sum all action durations
    const plan = plansForCell[0] as PlanBlock | undefined;
    const planStart = plan ? (plan.startAt instanceof Date ? plan.startAt : new Date(plan.startAt)) : null;
    const planEnd = plan ? (plan.endAt instanceof Date ? plan.endAt : new Date(plan.endAt)) : null;
    const plannedMin = planStart && planEnd ? durationMin(planStart, planEnd) : null;

    let actualMinTotal: number | null = null;
    let firstActionStart: Date | null = null;
    let lastActionEnd: Date | null = null;

    if (hasAction) {
      let sumMin = 0;
      for (const ab of actionsForCell) {
        const start = ab.startAt instanceof Date ? ab.startAt : new Date(ab.startAt);
        const end = ab.endAt ? (ab.endAt instanceof Date ? ab.endAt : new Date(ab.endAt)) : null;
        if (!end) continue;
        sumMin += durationMin(start, end);
        if (!firstActionStart || start < firstActionStart) firstActionStart = start;
        if (!lastActionEnd || end > lastActionEnd) lastActionEnd = end;
      }
      // Only set if at least one completed action exists
      if (firstActionStart && lastActionEnd) {
        actualMinTotal = sumMin;
      }
    }

    const hasCompletedAction = actualMinTotal !== null;

    let completionStatus: CompletionStatus;
    if (hasPlan && hasCompletedAction) {
      const diff = Math.abs((actualMinTotal ?? 0) - (plannedMin ?? 0));
      completionStatus = diff < 5 ? "completed_as_planned" : "completed_with_changes";
    } else if (hasPlan && !hasCompletedAction) {
      completionStatus = "deferred";
    } else {
      completionStatus = "added_on_the_day";
    }

    const overrun =
      completionStatus !== "deferred" && plannedMin !== null && actualMinTotal !== null
        ? actualMinTotal - plannedMin
        : null;

    const allTaskPlans = (allPlansByTask.get(taskId) ?? []).map(toCoreBlock);
    const timesCarriedOver = carryCountOf(allTaskPlans);

    const review = reviewByDate.get(date);

    rows.push({
      date,
      task_name: task.title,
      project_name: project?.title ?? "No project",
      task_category: task.category ?? null,
      completion_status: completionStatus,
      planned_start_time: planStart ? toHHMM(planStart) : null,
      planned_end_time: planEnd ? toHHMM(planEnd) : null,
      planned_duration_min: plannedMin,
      actual_start_time: firstActionStart ? toHHMM(firstActionStart) : null,
      actual_end_time: lastActionEnd ? toHHMM(lastActionEnd) : null,
      actual_duration_min: hasCompletedAction ? actualMinTotal : null,
      duration_overrun_min: overrun,
      times_carried_over: timesCarriedOver,
      daily_journal: review?.journalText ?? null,
    });
  }

  rows.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    return a.task_name < b.task_name ? -1 : a.task_name > b.task_name ? 1 : 0;
  });

  return rows;
}
