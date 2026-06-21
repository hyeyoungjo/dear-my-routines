CREATE TYPE "public"."node_status" AS ENUM('pending', 'in_progress', 'done', 'carried', 'dropped');--> statement-breakpoint
CREATE TYPE "public"."node_type" AS ENUM('area', 'project', 'task', 'subtask');--> statement-breakpoint
CREATE TABLE "category_stats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"category" text NOT NULL,
	"avg_estimate" real,
	"avg_actual" real,
	"ratio" real,
	"sample_count" integer DEFAULT 0 NOT NULL,
	"trend" jsonb,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "category_stats" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "daily_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"date" date NOT NULL,
	"journal_text" text NOT NULL,
	"ai_analysis" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "daily_reviews" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "nodes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"parent_id" uuid,
	"type" "node_type" NOT NULL,
	"title" text NOT NULL,
	"notes" text,
	"links" text[],
	"estimate_minutes" integer,
	"actual_minutes" integer,
	"status" "node_status" DEFAULT 'pending' NOT NULL,
	"category" text,
	"is_big3" boolean DEFAULT false NOT NULL,
	"planned_date" date,
	"carry_count" integer DEFAULT 0 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "nodes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "time_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"node_id" uuid NOT NULL,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "time_logs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "nodes" ADD CONSTRAINT "nodes_parent_id_nodes_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_logs" ADD CONSTRAINT "time_logs_node_id_nodes_id_fk" FOREIGN KEY ("node_id") REFERENCES "public"."nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "category_stats_select" ON "category_stats" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select auth.uid()) = "category_stats"."user_id");--> statement-breakpoint
CREATE POLICY "category_stats_insert" ON "category_stats" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((select auth.uid()) = "category_stats"."user_id");--> statement-breakpoint
CREATE POLICY "category_stats_update" ON "category_stats" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((select auth.uid()) = "category_stats"."user_id") WITH CHECK ((select auth.uid()) = "category_stats"."user_id");--> statement-breakpoint
CREATE POLICY "category_stats_delete" ON "category_stats" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((select auth.uid()) = "category_stats"."user_id");--> statement-breakpoint
CREATE POLICY "daily_reviews_select" ON "daily_reviews" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select auth.uid()) = "daily_reviews"."user_id");--> statement-breakpoint
CREATE POLICY "daily_reviews_insert" ON "daily_reviews" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((select auth.uid()) = "daily_reviews"."user_id");--> statement-breakpoint
CREATE POLICY "daily_reviews_update" ON "daily_reviews" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((select auth.uid()) = "daily_reviews"."user_id") WITH CHECK ((select auth.uid()) = "daily_reviews"."user_id");--> statement-breakpoint
CREATE POLICY "daily_reviews_delete" ON "daily_reviews" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((select auth.uid()) = "daily_reviews"."user_id");--> statement-breakpoint
CREATE POLICY "nodes_select" ON "nodes" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select auth.uid()) = "nodes"."user_id");--> statement-breakpoint
CREATE POLICY "nodes_insert" ON "nodes" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((select auth.uid()) = "nodes"."user_id");--> statement-breakpoint
CREATE POLICY "nodes_update" ON "nodes" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((select auth.uid()) = "nodes"."user_id") WITH CHECK ((select auth.uid()) = "nodes"."user_id");--> statement-breakpoint
CREATE POLICY "nodes_delete" ON "nodes" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((select auth.uid()) = "nodes"."user_id");--> statement-breakpoint
CREATE POLICY "time_logs_select" ON "time_logs" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select auth.uid()) = "time_logs"."user_id");--> statement-breakpoint
CREATE POLICY "time_logs_insert" ON "time_logs" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((select auth.uid()) = "time_logs"."user_id");--> statement-breakpoint
CREATE POLICY "time_logs_update" ON "time_logs" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((select auth.uid()) = "time_logs"."user_id") WITH CHECK ((select auth.uid()) = "time_logs"."user_id");--> statement-breakpoint
CREATE POLICY "time_logs_delete" ON "time_logs" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((select auth.uid()) = "time_logs"."user_id");