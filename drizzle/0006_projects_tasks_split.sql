-- ADR-016: drop the nodes tree for a fixed projects + tasks model, and clean up
-- plan_blocks/action_blocks naming. Data-preserving: projects/tasks are filled
-- from nodes (ids preserved so plan/action FKs stay valid), then the block
-- columns are RENAMED (never dropped). nodes/task_blocks are left intact and get
-- dropped in a later cutover migration once no code references them.

-- 1) action_block_status enum (revives "doing": in-progress = no end yet) -----
CREATE TYPE "public"."action_block_status" AS ENUM('in-progress', 'done');--> statement-breakpoint

-- 2) projects ----------------------------------------------------------------
CREATE TABLE "projects" (
	"project_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"project_color" text,
	"created_on" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_on" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "projects" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "projects_select" ON "projects" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select auth.uid()) = "projects"."user_id");--> statement-breakpoint
CREATE POLICY "projects_insert" ON "projects" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((select auth.uid()) = "projects"."user_id");--> statement-breakpoint
CREATE POLICY "projects_update" ON "projects" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((select auth.uid()) = "projects"."user_id") WITH CHECK ((select auth.uid()) = "projects"."user_id");--> statement-breakpoint
CREATE POLICY "projects_delete" ON "projects" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((select auth.uid()) = "projects"."user_id");--> statement-breakpoint

-- 3) tasks -------------------------------------------------------------------
CREATE TABLE "tasks" (
	"task_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"project_id" uuid,
	"title" text NOT NULL,
	"notes" text,
	"category" text,
	"created_on" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_on" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tasks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_project_id_projects_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("project_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "tasks_select" ON "tasks" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select auth.uid()) = "tasks"."user_id");--> statement-breakpoint
CREATE POLICY "tasks_insert" ON "tasks" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((select auth.uid()) = "tasks"."user_id");--> statement-breakpoint
CREATE POLICY "tasks_update" ON "tasks" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((select auth.uid()) = "tasks"."user_id") WITH CHECK ((select auth.uid()) = "tasks"."user_id");--> statement-breakpoint
CREATE POLICY "tasks_delete" ON "tasks" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((select auth.uid()) = "tasks"."user_id");--> statement-breakpoint

-- 4) populate projects from nodes (type=project), preserving id --------------
INSERT INTO "projects" ("project_id", "user_id", "title", "project_color", "created_on", "updated_on")
SELECT "id", "user_id", "title", "color", "created_at", "updated_at"
FROM "nodes" WHERE "type" = 'project';--> statement-breakpoint

-- 5) populate tasks from nodes (type task/subtask), preserving id; project_id =
--    parent only when the parent is a project, else NULL (unassigned task) -----
INSERT INTO "tasks" ("task_id", "user_id", "project_id", "title", "notes", "category", "created_on", "updated_on")
SELECT n."id", n."user_id",
	CASE WHEN p."id" IS NOT NULL THEN n."parent_id" ELSE NULL END,
	n."title", n."notes", n."category", n."created_at", n."updated_at"
FROM "nodes" n
LEFT JOIN "nodes" p ON p."id" = n."parent_id" AND p."type" = 'project'
WHERE n."type" IN ('task', 'subtask');--> statement-breakpoint

-- 6) plan_blocks: rename columns + repoint FK from nodes to tasks ------------
ALTER TABLE "plan_blocks" DROP CONSTRAINT "plan_blocks_node_id_nodes_id_fk";--> statement-breakpoint
ALTER TABLE "plan_blocks" RENAME COLUMN "id" TO "plan_block_id";--> statement-breakpoint
ALTER TABLE "plan_blocks" RENAME COLUMN "node_id" TO "task_id";--> statement-breakpoint
ALTER TABLE "plan_blocks" RENAME COLUMN "grid_day" TO "date";--> statement-breakpoint
ALTER TABLE "plan_blocks" RENAME COLUMN "created_at" TO "created_on";--> statement-breakpoint
ALTER TABLE "plan_blocks" RENAME COLUMN "updated_at" TO "updated_on";--> statement-breakpoint
ALTER TABLE "plan_blocks" ADD CONSTRAINT "plan_blocks_task_id_tasks_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("task_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

-- 7) action_blocks: rename columns, add status, nullable end_at, repoint FK ---
ALTER TABLE "action_blocks" DROP CONSTRAINT "action_blocks_node_id_nodes_id_fk";--> statement-breakpoint
ALTER TABLE "action_blocks" RENAME COLUMN "id" TO "action_block_id";--> statement-breakpoint
ALTER TABLE "action_blocks" RENAME COLUMN "node_id" TO "task_id";--> statement-breakpoint
ALTER TABLE "action_blocks" RENAME COLUMN "grid_day" TO "date";--> statement-breakpoint
ALTER TABLE "action_blocks" RENAME COLUMN "created_at" TO "created_on";--> statement-breakpoint
ALTER TABLE "action_blocks" RENAME COLUMN "updated_at" TO "updated_on";--> statement-breakpoint
ALTER TABLE "action_blocks" ALTER COLUMN "end_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "action_blocks" ADD COLUMN "status" "action_block_status" DEFAULT 'done' NOT NULL;--> statement-breakpoint
ALTER TABLE "action_blocks" ADD CONSTRAINT "action_blocks_task_id_tasks_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("task_id") ON DELETE cascade ON UPDATE no action;
