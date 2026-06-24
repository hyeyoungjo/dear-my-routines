CREATE TYPE "public"."user_role" AS ENUM('admin', 'tester', 'user');--> statement-breakpoint
ALTER TABLE "allowed_emails" ADD COLUMN "role" "user_role" DEFAULT 'user' NOT NULL;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "encrypted_api_key" text;