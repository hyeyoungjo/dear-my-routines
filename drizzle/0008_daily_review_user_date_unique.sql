-- Step 8.0 (ADR-006 review journal): one journal per (user, day). This unique
-- index is the conflict target for the daily-reviews upsert
-- (PUT /api/daily-reviews onConflictDoUpdate), so the DB guarantees a single
-- review row per user per grid day.
--
-- Hand-written (like 0006/0007): the drizzle meta snapshots drifted from the
-- live schema during the data-preserving nodes→projects/tasks renames, so
-- `drizzle-kit generate` can't emit a clean single-purpose diff here.
CREATE UNIQUE INDEX IF NOT EXISTS "daily_reviews_user_date_uq" ON "daily_reviews" USING btree ("user_id","date");
