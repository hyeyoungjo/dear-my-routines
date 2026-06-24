import { eq } from "drizzle-orm";
import { db } from "@/db";
import { allowedEmails } from "@/db/schema";

export type UserRole = "admin" | "tester" | "user";

/**
 * Returns the role for an email from the allowed_emails table.
 * Falls back to "user" if the email isn't in the allowlist (shouldn't happen
 * in normal flow since middleware blocks unapproved emails, but safe default).
 */
export async function getUserRole(email: string): Promise<UserRole> {
  const [row] = await db
    .select({ role: allowedEmails.role })
    .from(allowedEmails)
    .where(eq(allowedEmails.email, email.toLowerCase()));
  return (row?.role ?? "user") as UserRole;
}

/**
 * Returns true for roles that use the environment GEMINI_API_KEY
 * instead of requiring the user to supply their own key.
 */
export function usesEnvApiKey(role: UserRole): boolean {
  return role === "admin" || role === "tester";
}
