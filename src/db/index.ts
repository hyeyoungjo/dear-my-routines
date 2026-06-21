import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Runtime Drizzle client (separate from drizzle-kit's config).
 *
 * SERVER-ONLY: this module reads DB_PASSWORD, so it must never be imported into
 * a client bundle (CLAUDE.md CRITICAL — secrets stay on the server). Only Route
 * Handlers / Server Components import it.
 *
 * Connection uses the Supabase Session pooler (IPv4) — the same pattern as
 * drizzle.config.ts. The direct host (db.<ref>.supabase.co) is IPv6-only and
 * fails to resolve in many environments. The project ref is derived from
 * NEXT_PUBLIC_SUPABASE_URL; the password is its own env var so special
 * characters need no URL-encoding.
 */
const ref = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split(".")[0];

function createClient() {
  return postgres({
    host: "aws-1-us-west-2.pooler.supabase.com",
    port: 5432,
    user: `postgres.${ref}`,
    database: "postgres",
    password: process.env.DB_PASSWORD!,
    ssl: "require",
  });
}

// Reuse a single connection across hot-reloads in dev so we don't exhaust the
// pooler with a new client on every module re-evaluation.
const globalForDb = globalThis as unknown as {
  pgClient?: ReturnType<typeof createClient>;
};
const client = globalForDb.pgClient ?? createClient();
if (process.env.NODE_ENV !== "production") globalForDb.pgClient = client;

export const db = drizzle(client, { schema });
