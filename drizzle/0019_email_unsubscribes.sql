CREATE TABLE "email_unsubscribes" (
	"email" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "email_unsubscribes" ENABLE ROW LEVEL SECURITY;
