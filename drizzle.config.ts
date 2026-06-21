import { defineConfig } from "drizzle-kit";

/**
 * Drizzle Kit config.
 * `generate` builds migration SQL from the schema alone (no DB needed).
 * `migrate`/`push` need DATABASE_URL (Supabase → Settings → Database → URI).
 */
export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
