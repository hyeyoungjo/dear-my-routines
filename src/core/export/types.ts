export type CompletionStatus =
  | "completed_as_planned"   // plan_block + action_block both exist, time diff < 5 min
  | "completed_with_changes" // plan_block + action_block both exist, time diff >= 5 min
  | "deferred"               // plan_block exists but no action_block (missed)
  | "added_on_the_day";      // action_block exists but no plan_block (unplanned addition)

export type ExportRow = {
  date: string;                        // "YYYY-MM-DD"
  task_name: string;
  project_name: string;
  task_category: string | null;
  completion_status: CompletionStatus;
  planned_start_time: string | null;   // "HH:MM"
  planned_end_time: string | null;
  planned_duration_min: number | null;
  actual_start_time: string | null;    // "HH:MM"
  actual_end_time: string | null;
  actual_duration_min: number | null;
  duration_overrun_min: number | null; // actual - planned; null if deferred
  times_carried_over: number;
  daily_journal: string | null;
};
