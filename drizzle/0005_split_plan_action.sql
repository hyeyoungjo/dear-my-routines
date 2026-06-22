CREATE TYPE "public"."plan_block_status" AS ENUM('planned', 'missed');--> statement-breakpoint
CREATE TABLE "action_blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"node_id" uuid NOT NULL,
	"grid_day" date NOT NULL,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "action_blocks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "plan_blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"node_id" uuid NOT NULL,
	"grid_day" date NOT NULL,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone NOT NULL,
	"status" "plan_block_status" DEFAULT 'planned' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "plan_blocks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "action_blocks" ADD CONSTRAINT "action_blocks_node_id_nodes_id_fk" FOREIGN KEY ("node_id") REFERENCES "public"."nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_blocks" ADD CONSTRAINT "plan_blocks_node_id_nodes_id_fk" FOREIGN KEY ("node_id") REFERENCES "public"."nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "action_blocks_select" ON "action_blocks" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select auth.uid()) = "action_blocks"."user_id");--> statement-breakpoint
CREATE POLICY "action_blocks_insert" ON "action_blocks" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((select auth.uid()) = "action_blocks"."user_id");--> statement-breakpoint
CREATE POLICY "action_blocks_update" ON "action_blocks" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((select auth.uid()) = "action_blocks"."user_id") WITH CHECK ((select auth.uid()) = "action_blocks"."user_id");--> statement-breakpoint
CREATE POLICY "action_blocks_delete" ON "action_blocks" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((select auth.uid()) = "action_blocks"."user_id");--> statement-breakpoint
CREATE POLICY "plan_blocks_select" ON "plan_blocks" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select auth.uid()) = "plan_blocks"."user_id");--> statement-breakpoint
CREATE POLICY "plan_blocks_insert" ON "plan_blocks" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((select auth.uid()) = "plan_blocks"."user_id");--> statement-breakpoint
CREATE POLICY "plan_blocks_update" ON "plan_blocks" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((select auth.uid()) = "plan_blocks"."user_id") WITH CHECK ((select auth.uid()) = "plan_blocks"."user_id");--> statement-breakpoint
CREATE POLICY "plan_blocks_delete" ON "plan_blocks" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((select auth.uid()) = "plan_blocks"."user_id");--> statement-breakpoint
-- ADR-015 data migration: split task_blocks' plan side into plan_blocks and its
-- actual side into action_blocks. Tables/policies above are created first, then
-- rows are copied here. task_blocks is left intact (dropped in a follow-up
-- migration once no code references it), so this step is non-destructive.
INSERT INTO "plan_blocks" ("id", "user_id", "node_id", "grid_day", "start_at", "end_at", "status", "created_at", "updated_at")
SELECT "id", "user_id", "node_id", "grid_day", "planned_start", "planned_end",
	(CASE WHEN "status" = 'missed' THEN 'missed' ELSE 'planned' END)::"public"."plan_block_status",
	"created_at", "updated_at"
FROM "task_blocks"
WHERE "planned_start" IS NOT NULL AND "planned_end" IS NOT NULL;--> statement-breakpoint
INSERT INTO "action_blocks" ("user_id", "node_id", "grid_day", "start_at", "end_at", "created_at", "updated_at")
SELECT "user_id", "node_id", "grid_day", "actual_start", "actual_end", "created_at", "updated_at"
FROM "task_blocks"
WHERE "actual_start" IS NOT NULL AND "actual_end" IS NOT NULL;