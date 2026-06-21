import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// drizzle-kit runs outside Next.js, so load .env explicitly.
config();

/**
 * Drizzle Kit config.
 * `generate` builds migration SQL from the schema alone (no DB needed).
 * `migrate`/`push` connect to Supabase Postgres via the Session pooler (IPv4) —
 * the direct host (db.<ref>.supabase.co) is IPv6-only and fails to resolve locally.
 *
 * The password is its own env var (DB_PASSWORD) so special characters need no
 * URL-encoding. The project ref is derived from NEXT_PUBLIC_SUPABASE_URL.
 */
const ref = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split(".")[0];

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    host: "aws-1-us-west-2.pooler.supabase.com",
    port: 5432,
    user: `postgres.${ref}`,
    database: "postgres",
    password: process.env.DB_PASSWORD!,
    ssl: "require",
  },
});
