-- ADR-016 refinement: action_blocks has no stored status. Its kind (kept /
-- revised / added vs the plan) and "doing" (now within its span) are derived in
-- core/time, never stored. Drop the column added in 0006 and its enum.
ALTER TABLE "action_blocks" DROP COLUMN "status";--> statement-breakpoint
DROP TYPE "public"."action_block_status";
