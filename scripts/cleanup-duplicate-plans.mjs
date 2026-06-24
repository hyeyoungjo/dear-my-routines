// One-off maintenance: remove the duplicate plan_blocks left behind by the
// carry-over bug (see commit "fix: stop carrying finished tasks forward").
//
// Background: completion lives on action_blocks, not plan_blocks. Before the
// fix, the day-boundary sweep carried a finished task's still-`planned` plan
// forward every day, so done tasks accumulated bogus plans on days AFTER they
// were actually done — re-surfacing as "todo" duplicates.
//
// For every task that has at least one action (= done), with
// doneDay = MAX(action_blocks.date):
//   DELETE  plan_blocks with date >  doneDay  (the bogus carried-forward chain)
//   RESTORE plan_blocks with date == doneDay AND status='missed' -> 'planned'
//           (the done day's plan, flipped to missed by the first carry)
// Plans on days BEFORE doneDay (genuine pre-completion history) are untouched.
//
// SAFETY: dry-run by default — prints exactly what it would change and writes
// nothing. Pass --apply to execute (inside a single transaction). Optionally
// scope to one user with --email=someone@example.com.
//
// Run:  node scripts/cleanup-duplicate-plans.mjs            (preview)
//       node scripts/cleanup-duplicate-plans.mjs --apply    (execute)
//       node scripts/cleanup-duplicate-plans.mjs --email=me@x.com --apply
//
// Env: reads NEXT_PUBLIC_SUPABASE_URL + DB_PASSWORD (from real env on Railway,
// or .env.local / .env locally), the same connection the app uses.

import postgres from "postgres";
import { config } from "dotenv";

config({ path: [".env.local", ".env"] });

const APPLY = process.argv.includes("--apply");
const emailArg = process.argv.find((a) => a.startsWith("--email="));
const email = emailArg ? emailArg.slice("--email=".length) : null;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const dbPassword = process.env.DB_PASSWORD;
if (!supabaseUrl || !dbPassword) {
  console.error(
    "Missing env: NEXT_PUBLIC_SUPABASE_URL and DB_PASSWORD must be set " +
      "(check .env.local or your shell).",
  );
  process.exit(1);
}

const ref = new URL(supabaseUrl).hostname.split(".")[0];
const sql = postgres({
  host: "aws-1-us-west-2.pooler.supabase.com",
  port: 5432,
  user: `postgres.${ref}`,
  database: "postgres",
  password: dbPassword,
  ssl: "require",
});

// Optional per-user scope. Only touch the auth schema when an email is given,
// so the default run stays within our own tables.
const userJoin = email ? sql`JOIN auth.users u ON u.id = t.user_id` : sql``;
const userFilter = email ? sql`AND u.email = ${email}` : sql``;

try {
  // Preview: one row per plan_block we would change, with the verdict.
  const rows = await sql`
    WITH done AS (
      SELECT task_id, MAX(date) AS done_day
      FROM action_blocks
      GROUP BY task_id
    )
    SELECT
      t.user_id,
      t.title,
      p.plan_block_id,
      p.date::text AS date,
      p.status,
      d.done_day::text AS done_day,
      CASE
        WHEN p.date > d.done_day THEN 'DELETE'
        ELSE 'RESTORE'
      END AS verdict
    FROM plan_blocks p
    JOIN done d ON d.task_id = p.task_id
    JOIN tasks t ON t.task_id = p.task_id
    ${userJoin}
    WHERE (p.date > d.done_day)
       OR (p.date = d.done_day AND p.status = 'missed')
       ${userFilter}
    ORDER BY t.user_id, t.title, p.date
  `;

  if (rows.length === 0) {
    console.log("Nothing to clean up — no bogus plans found. 🎉");
    await sql.end();
    process.exit(0);
  }

  // Print grouped by user, then task.
  let currentUser = null;
  let currentTask = null;
  for (const r of rows) {
    if (r.user_id !== currentUser) {
      currentUser = r.user_id;
      currentTask = null;
      console.log(`\nUser ${r.user_id}`);
    }
    if (r.title !== currentTask) {
      currentTask = r.title;
      console.log(`  Task "${r.title}" (done ${r.done_day})`);
    }
    console.log(`    ${r.verdict.padEnd(7)} ${r.date}  [was ${r.status}]`);
  }

  const toDelete = rows.filter((r) => r.verdict === "DELETE").length;
  const toRestore = rows.filter((r) => r.verdict === "RESTORE").length;
  console.log(
    `\nSummary: ${toDelete} plan(s) to DELETE, ${toRestore} to RESTORE to 'planned'.`,
  );

  if (!APPLY) {
    console.log("\nDRY RUN — nothing was changed. Re-run with --apply to execute.");
    await sql.end();
    process.exit(0);
  }

  // Apply both changes atomically. The same `done` CTE / predicates as above.
  await sql.begin(async (tx) => {
    const deleted = await tx`
      WITH done AS (
        SELECT task_id, MAX(date) AS done_day
        FROM action_blocks GROUP BY task_id
      )
      DELETE FROM plan_blocks p
      USING done d, tasks t ${userJoin}
      WHERE d.task_id = p.task_id
        AND t.task_id = p.task_id
        AND p.date > d.done_day
        ${userFilter}
    `;
    const restored = await tx`
      WITH done AS (
        SELECT task_id, MAX(date) AS done_day
        FROM action_blocks GROUP BY task_id
      )
      UPDATE plan_blocks p
      SET status = 'planned', updated_on = now()
      FROM done d, tasks t ${userJoin}
      WHERE d.task_id = p.task_id
        AND t.task_id = p.task_id
        AND p.date = d.done_day
        AND p.status = 'missed'
        ${userFilter}
    `;
    console.log(
      `\nApplied: deleted ${deleted.count} plan(s), restored ${restored.count}.`,
    );
  });

  console.log("Done. ✅");
  await sql.end();
} catch (err) {
  console.error("\nCleanup failed:", err.message ?? err);
  await sql.end({ timeout: 5 });
  process.exit(1);
}
