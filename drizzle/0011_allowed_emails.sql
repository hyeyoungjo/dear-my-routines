CREATE TABLE "allowed_emails" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "email" text NOT NULL,
  "note" text,
  "created_on" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "allowed_emails" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE UNIQUE INDEX "allowed_emails_email_uq" ON "allowed_emails" USING btree ("email");
--> statement-breakpoint
CREATE POLICY "allowed_emails_self_read" ON "allowed_emails"
  AS PERMISSIVE FOR SELECT TO "authenticated"
  USING (email = (select auth.email()));
