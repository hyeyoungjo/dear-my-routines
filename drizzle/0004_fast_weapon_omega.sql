ALTER TABLE "nodes" DROP COLUMN "actual_minutes";--> statement-breakpoint
ALTER TABLE "nodes" DROP COLUMN "planned_start";--> statement-breakpoint
ALTER TABLE "nodes" DROP COLUMN "planned_end";--> statement-breakpoint
ALTER TABLE "nodes" DROP COLUMN "actual_start";--> statement-breakpoint
ALTER TABLE "nodes" DROP COLUMN "actual_end";--> statement-breakpoint
ALTER TABLE "nodes" DROP COLUMN "status";--> statement-breakpoint
ALTER TABLE "nodes" DROP COLUMN "planned_date";--> statement-breakpoint
ALTER TABLE "nodes" DROP COLUMN "carry_count";--> statement-breakpoint
DROP TYPE "public"."node_status";