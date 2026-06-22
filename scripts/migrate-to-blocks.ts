/**
 * One-off, idempotent data migration: nodes' time fields → task_blocks (ADR-014).
 *
 * For every node that carries a planned or actual span, create one task_block
 * that mirrors it. The node's own time columns are left untouched here (they're
 * removed later, in step 5) so the calendar keeps working mid-transition.
 *
 * Idempotent: a node that already has any task_block is skipped, so re-running
 * never duplicates a block. Run with:  npx tsx scripts/migrate-to-blocks.ts
 *
 * SERVER-ONLY context (reads DB_PASSWORD via .env) — this is a CLI script, never
 * bundled for the client. It opens its own connection (after loading .env)
 * rather than importing src/db, whose client reads env eagerly at import time.
 */
import { config } from "dotenv";
import { isNotNull, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { nodes, taskBlocks } from "../src/db/schema";
import { gridDayOf } from "../src/core/time/day";

config();

// Same Supabase Session pooler (IPv4) connection pattern as drizzle.config.ts.
const ref = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split(".")[0];
const client = postgres({
  host: "aws-1-us-west-2.pooler.supabase.com",
  port: 5432,
  user: `postgres.${ref}`,
  database: "postgres",
  password: process.env.DB_PASSWORD!,
  ssl: "require",
});
const db = drizzle(client, { schema: { nodes, taskBlocks } });

async function main() {
  // Nodes that hold any time span — the rows whose placement must move to blocks.
  const timed = await db
    .select()
    .from(nodes)
    .where(or(isNotNull(nodes.plannedStart), isNotNull(nodes.actualStart)));

  // Already-migrated node ids (idempotency guard).
  const existing = await db
    .select({ nodeId: taskBlocks.nodeId })
    .from(taskBlocks);
  const alreadyMigrated = new Set(existing.map((b) => b.nodeId));

  let created = 0;
  let skipped = 0;

  for (const node of timed) {
    if (alreadyMigrated.has(node.id)) {
      skipped++;
      continue;
    }

    // grid_day follows the calendar's 07:00 boundary (gridDayOf), so the block's
    // day matches where it would be drawn. Prefer the planned anchor, else actual.
    const anchor = node.plannedStart ?? node.actualStart;
    if (!anchor) continue; // unreachable given the query, but keeps types honest.

    await db.insert(taskBlocks).values({
      userId: node.userId,
      nodeId: node.id,
      gridDay: gridDayOf(new Date(anchor)),
      plannedStart: node.plannedStart,
      plannedEnd: node.plannedEnd,
      actualStart: node.actualStart,
      actualEnd: node.actualEnd,
      status: node.actualStart ? "done" : "planned",
      sortOrder: node.sortOrder,
    });
    created++;
  }

  console.log(
    `task_blocks migration: ${created} created, ${skipped} skipped (already migrated), ${timed.length} timed nodes total.`,
  );
}

main()
  .then(() => client.end())
  .then(() => process.exit(0))
  .catch(async (err) => {
    console.error(err);
    await client.end();
    process.exit(1);
  });
