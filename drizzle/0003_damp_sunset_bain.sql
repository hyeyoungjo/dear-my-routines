CREATE TYPE "public"."block_status" AS ENUM('planned', 'done', 'missed');--> statement-breakpoint
CREATE TABLE "task_blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"node_id" uuid NOT NULL,
	"grid_day" date NOT NULL,
	"planned_start" timestamp with time zone,
	"planned_end" timestamp with time zone,
	"actual_start" timestamp with time zone,
	"actual_end" timestamp with time zone,
	"status" "block_status" DEFAULT 'planned' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "task_blocks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "task_blocks" ADD CONSTRAINT "task_blocks_node_id_nodes_id_fk" FOREIGN KEY ("node_id") REFERENCES "public"."nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "task_blocks_select" ON "task_blocks" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select auth.uid()) = "task_blocks"."user_id");--> statement-breakpoint
CREATE POLICY "task_blocks_insert" ON "task_blocks" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((select auth.uid()) = "task_blocks"."user_id");--> statement-breakpoint
CREATE POLICY "task_blocks_update" ON "task_blocks" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((select auth.uid()) = "task_blocks"."user_id") WITH CHECK ((select auth.uid()) = "task_blocks"."user_id");--> statement-breakpoint
CREATE POLICY "task_blocks_delete" ON "task_blocks" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((select auth.uid()) = "task_blocks"."user_id");