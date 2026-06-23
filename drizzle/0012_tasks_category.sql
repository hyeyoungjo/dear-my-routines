-- category column was already included in 0006_projects_tasks_split when the
-- tasks table was first created. This migration is a safe no-op for any DB
-- that ran 0006+, and adds the column for any DB that was created without it.
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "category" text;
