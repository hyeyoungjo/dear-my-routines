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
  (t) => ownerPolicies("daily_reviews", t.userId),
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

export type TaskBlock = InferSelectModel<typeof taskBlocks>;
export type NewTaskBlock = InferInsertModel<typeof taskBlocks>;

export type TimeLog = InferSelectModel<typeof timeLogs>;
export type NewTimeLog = InferInsertModel<typeof timeLogs>;

export type DailyReview = InferSelectModel<typeof dailyReviews>;
export type NewDailyReview = InferInsertModel<typeof dailyReviews>;

export type CategoryStat = InferSelectModel<typeof categoryStats>;
export type NewCategoryStat = InferInsertModel<typeof categoryStats>;
