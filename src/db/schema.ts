import { sql, type InferInsertModel, type InferSelectModel } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  date,
  integer,
  jsonb,
  pgEnum,
  pgPolicy,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { authenticatedRole } from "drizzle-orm/supabase";

/**
 * Owner-only RLS policies for a table.
 *
 * Every table carries a `user_id` and may only be touched by the row's owner
 * (CLAUDE.md CRITICAL, ADR-003). The check `(select auth.uid()) = user_id`
 * means even a direct client query can never reach another user's rows.
 * Attaching any policy auto-enables RLS on the table.
 */
function ownerPolicies(name: string, userId: AnyPgColumn) {
  const isOwner = sql`(select auth.uid()) = ${userId}`;
  return [
    pgPolicy(`${name}_select`, {
      for: "select",
      to: authenticatedRole,
      using: isOwner,
    }),
    pgPolicy(`${name}_insert`, {
      for: "insert",
      to: authenticatedRole,
      withCheck: isOwner,
    }),
    pgPolicy(`${name}_update`, {
      for: "update",
      to: authenticatedRole,
      using: isOwner,
      withCheck: isOwner,
    }),
    pgPolicy(`${name}_delete`, {
      for: "delete",
      to: authenticatedRole,
      using: isOwner,
    }),
  ];
}

// --- Enums ----------------------------------------------------------------

export const nodeType = pgEnum("node_type", [
  "area",
  "project",
  "task",
  "subtask",
]);

// A task_block's lifecycle on a single grid day (ADR-014). `missed` is the
// carry-over signal: an unfinished planned block stays `missed` and a *new*
// block is born on the next day (same node, time kept).
export const blockStatus = pgEnum("block_status", [
  "planned",
  "done",
  "missed",
]);

// A plan_block's lifecycle (ADR-015). Plan and action are now separate lists;
// "done" no longer lives here — completion is expressed by an action_block
// existing. A carried-over plan stays `missed` (kept as review evidence) while
// a fresh `planned` block is born on the next day.
export const planBlockStatus = pgEnum("plan_block_status", [
  "planned",
  "missed",
]);

// --- nodes: flexible Area > Project > Task > Subtask tree (ADR-009) --------

export const nodes = pgTable(
  "nodes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    // Self-reference: null = top-level (Area). Deleting a parent cascades.
    parentId: uuid("parent_id").references((): AnyPgColumn => nodes.id, {
      onDelete: "cascade",
    }),
    type: nodeType("type").notNull(),
    title: text("title").notNull(),
    notes: text("notes"),
    links: text("links").array(),
    // Estimated minutes — the task's *prediction*, a stats unit (ADR-014).
    // Actual time and per-day placement now live on task_blocks, not here.
    estimateMinutes: integer("estimate_minutes"),
    category: text("category"),
    // Optional explicit colour (hex) — used for a project's legend chip and the
    // colour its tasks inherit. Falls back to a deterministic id-based colour
    // when unset (see lib/projectColor).
    color: text("color"),
    isBig3: boolean("is_big3").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ownerPolicies("nodes", t.userId),
);

// --- task_blocks: per-day plan+actual placement of a task (ADR-014) -------

/**
 * A task's *occurrence* on one grid day. `nodes` holds task identity and the
 * stats unit (title/category/estimate/tree); a `task_block` is one date's
 * planned + actual placement of that task, 1:N from a node.
 *
 * Carry-over is expressed here, not on the node: an unfinished planned block
 * stays `missed` and a fresh block is created on the next grid day (same
 * `nodeId`, times kept). `planned`/`revised`/`actual` dates and `carryCount`
 * are *derived* from a node's blocks, never stored as columns.
 */
export const taskBlocks = pgTable(
  "task_blocks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    nodeId: uuid("node_id")
      .notNull()
      .references(() => nodes.id, { onDelete: "cascade" }),
    // The grid day this block belongs to (07:00 boundary, see core/time/day).
    gridDay: date("grid_day").notNull(),
    plannedStart: timestamp("planned_start", { withTimezone: true }),
    plannedEnd: timestamp("planned_end", { withTimezone: true }),
    actualStart: timestamp("actual_start", { withTimezone: true }),
    actualEnd: timestamp("actual_end", { withTimezone: true }),
    status: blockStatus("status").notNull().default("planned"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ownerPolicies("task_blocks", t.userId),
);

// --- projects: top level of the fixed two-level model (ADR-016) ------------

/**
 * A project — the only grouping level above a task (ADR-016 drops the flexible
 * nodes tree). Holds a name + colour its tasks inherit. A project's "current
 * status" is derived from its tasks' plans/actions, never stored.
 */
export const projects = pgTable(
  "projects",
  {
    projectId: uuid("project_id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    title: text("title").notNull(),
    // Optional explicit colour (hex); falls back to a deterministic id-based
    // colour when unset (see lib/projectColor).
    projectColor: text("project_color"),
    createdOn: timestamp("created_on", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedOn: timestamp("updated_on", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ownerPolicies("projects", t.userId),
);

// --- tasks: the identity + stats unit (ADR-016) ---------------------------

/**
 * A task — identity and the stats unit. Per-day placement lives on plan_blocks
 * (intent) and action_blocks (reality), 1:N. `projectId` is nullable so a task
 * can be unassigned ("No project"); deleting a project just unassigns its tasks.
 * `category` stays for PRD category stats; estimate/isBig3/links/sortOrder are
 * dropped (ADR-016 minimal spec). Current status is derived, never stored.
 */
export const tasks = pgTable(
  "tasks",
  {
    taskId: uuid("task_id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    projectId: uuid("project_id").references(() => projects.projectId, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    notes: text("notes"),
    category: text("category"),
    createdOn: timestamp("created_on", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedOn: timestamp("updated_on", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ownerPolicies("tasks", t.userId),
);

// --- plan_blocks: per-day *intention* of a task (ADR-015/016) --------------

/**
 * One day's plan for a task — "I intend to do this, here, then". Identity and
 * the stats unit live on `tasks`; a task's plans are 1:N plan_blocks. Carry-over
 * is expressed here: an unfinished plan stays `missed` (kept as review evidence)
 * and a fresh `planned` block is created on the next grid day (same task, time
 * kept). Plans are always placed as boxes, so `start_at`/`end_at` are required.
 *
 * Action lives in `action_blocks`, so a single row never holds plan + actual
 * together (no forced "2h→9h" label).
 */
export const planBlocks = pgTable(
  "plan_blocks",
  {
    planBlockId: uuid("plan_block_id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.taskId, { onDelete: "cascade" }),
    // The grid day this plan belongs to (07:00 boundary, see core/time/day).
    date: date("date").notNull(),
    startAt: timestamp("start_at", { withTimezone: true }).notNull(),
    endAt: timestamp("end_at", { withTimezone: true }).notNull(),
    status: planBlockStatus("status").notNull().default("planned"),
    createdOn: timestamp("created_on", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedOn: timestamp("updated_on", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ownerPolicies("plan_blocks", t.userId),
);

// --- action_blocks: per-day *actual execution* of a task (ADR-015) ---------

/**
 * One span of actually doing a task — reality, not intention (ADR-015/016). A
 * task done across two days is two rows. Its *kind* (kept / revised / added vs
 * the plan) and whether it is *doing* (now within its span) are derived, never
 * stored (see core/time). Stats join plan_blocks + action_blocks by `task_id`;
 * the estimate-vs-actual comparison is computed there, never on a calendar block.
 */
export const actionBlocks = pgTable(
  "action_blocks",
  {
    actionBlockId: uuid("action_block_id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.taskId, { onDelete: "cascade" }),
    date: date("date").notNull(),
    startAt: timestamp("start_at", { withTimezone: true }).notNull(),
    // Nullable: a still-running span has no end time yet (future timer).
    endAt: timestamp("end_at", { withTimezone: true }),
    createdOn: timestamp("created_on", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedOn: timestamp("updated_on", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ownerPolicies("action_blocks", t.userId),
);

// --- time_logs: actual measured spans, optionally per node ----------------

export const timeLogs = pgTable(
  "time_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    nodeId: uuid("node_id")
      .notNull()
      .references(() => nodes.id, { onDelete: "cascade" }),
    startAt: timestamp("start_at", { withTimezone: true }).notNull(),
    endAt: timestamp("end_at", { withTimezone: true }),
  },
  (t) => ownerPolicies("time_logs", t.userId),
);

// --- daily_reviews: daily journal + AI analysis ---------------------------

export const dailyReviews = pgTable(
  "daily_reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    date: date("date").notNull(),
    journalText: text("journal_text").notNull(),
    aiAnalysis: jsonb("ai_analysis"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  // One journal per (user, day): the unique index is the upsert conflict target
  // (PUT /api/daily-reviews onConflictDoUpdate), DB-guaranteeing "one review/day".
  (t) => [
    uniqueIndex("daily_reviews_user_date_uq").on(t.userId, t.date),
    ...ownerPolicies("daily_reviews", t.userId),
  ],
);

// --- user_settings: per-user preferences (ADR-020) ------------------------

/**
 * One settings row per user. Currently holds only the preferred AI model;
 * more columns can be added as settings grow. `aiModel` null means "use the
 * env default" (`GEMINI_MODEL`). The unique index on `user_id` is the upsert
 * conflict target for PUT /api/user-settings.
 */
export const userSettings = pgTable(
  "user_settings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    // Preferred AI model id (from services/ai/models AI_MODELS[].id).
    // null = fall back to env GEMINI_MODEL default.
    aiModel: text("ai_model"),
    // Whether the user has opted in to AI analysis. Default false — opt-in.
    aiEnabled: boolean("ai_enabled").notNull().default(false),
    // UI language preference (LanguageId). null = fall back to 'en' default.
    language: text("language"),
    // UI font preference (FontId). null = fall back to 'nanum-gothic' default.
    font: text("font"),
    createdOn: timestamp("created_on", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedOn: timestamp("updated_on", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("user_settings_user_uq").on(t.userId),
    ...ownerPolicies("user_settings", t.userId),
  ],
);

// --- allowed_emails: access control allowlist (phase 10) ------------------

/**
 * Allowlist of emails permitted to use the app. The middleware (step 1) checks
 * this table on every request. Rows are managed by the admin only (Supabase
 * dashboard or service key) — users have no INSERT/UPDATE/DELETE policy, so
 * they cannot add themselves. The SELECT policy lets an authenticated user
 * verify their own email only, without exposing the full list.
 *
 * No `user_id` column: this table identifies access by email, not by uid, so
 * `ownerPolicies` does not apply here.
 */
export const allowedEmails = pgTable(
  "allowed_emails",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    note: text("note"),
    createdOn: timestamp("created_on", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("allowed_emails_email_uq").on(t.email),
    pgPolicy("allowed_emails_self_read", {
      for: "select",
      to: authenticatedRole,
      using: sql`email = (select auth.email())`,
    }),
  ],
);

// --- category_stats: layer-2 aggregate memory (ADR-006) -------------------

export const categoryStats = pgTable(
  "category_stats",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    category: text("category").notNull(),
    avgEstimate: real("avg_estimate"),
    avgActual: real("avg_actual"),
    ratio: real("ratio"),
    sampleCount: integer("sample_count").notNull().default(0),
    trend: jsonb("trend"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ownerPolicies("category_stats", t.userId),
);

// --- Inferred types -------------------------------------------------------

export type Node = InferSelectModel<typeof nodes>;
export type NewNode = InferInsertModel<typeof nodes>;

export type Project = InferSelectModel<typeof projects>;
export type NewProject = InferInsertModel<typeof projects>;

export type Task = InferSelectModel<typeof tasks>;
export type NewTask = InferInsertModel<typeof tasks>;

export type TaskBlock = InferSelectModel<typeof taskBlocks>;
export type NewTaskBlock = InferInsertModel<typeof taskBlocks>;

export type PlanBlock = InferSelectModel<typeof planBlocks>;
export type NewPlanBlock = InferInsertModel<typeof planBlocks>;

export type ActionBlock = InferSelectModel<typeof actionBlocks>;
export type NewActionBlock = InferInsertModel<typeof actionBlocks>;

export type TimeLog = InferSelectModel<typeof timeLogs>;
export type NewTimeLog = InferInsertModel<typeof timeLogs>;

export type DailyReview = InferSelectModel<typeof dailyReviews>;
export type NewDailyReview = InferInsertModel<typeof dailyReviews>;

export type CategoryStat = InferSelectModel<typeof categoryStats>;
export type NewCategoryStat = InferInsertModel<typeof categoryStats>;

export type UserSettings = InferSelectModel<typeof userSettings>;
export type NewUserSettings = InferInsertModel<typeof userSettings>;

export type AllowedEmail = InferSelectModel<typeof allowedEmails>;
