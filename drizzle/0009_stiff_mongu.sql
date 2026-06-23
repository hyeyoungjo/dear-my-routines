CREATE TABLE "user_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"ai_model" text,
	"created_on" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_on" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE UNIQUE INDEX "user_settings_user_uq" ON "user_settings" USING btree ("user_id");--> statement-breakpoint
CREATE POLICY "user_settings_select" ON "user_settings" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select auth.uid()) = "user_settings"."user_id");--> statement-breakpoint
CREATE POLICY "user_settings_insert" ON "user_settings" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((select auth.uid()) = "user_settings"."user_id");--> statement-breakpoint
CREATE POLICY "user_settings_update" ON "user_settings" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((select auth.uid()) = "user_settings"."user_id") WITH CHECK ((select auth.uid()) = "user_settings"."user_id");--> statement-breakpoint
CREATE POLICY "user_settings_delete" ON "user_settings" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((select auth.uid()) = "user_settings"."user_id");
