ALTER TABLE "nodes" ADD COLUMN "planned_start" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "nodes" ADD COLUMN "planned_end" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "nodes" ADD COLUMN "actual_start" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "nodes" ADD COLUMN "actual_end" timestamp with time zone;