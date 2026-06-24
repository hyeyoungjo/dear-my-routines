import { eq } from "drizzle-orm";
import { db } from "@/db";
import { userSettings } from "@/db/schema";
import { decryptApiKey } from "@/lib/apiKeyEncryption";
import { getUserRole, usesEnvApiKey } from "@/lib/userRole";

/**
 * Resolves the Gemini API key for a given user.
 *
 * Resolution order:
 *   1. admin / tester role  → env GEMINI_API_KEY (no key storage needed)
 *   2. regular user         → decrypt encrypted_api_key from user_settings
 *
 * Throws a descriptive error if no key is available, so callers can return
 * a clean 402/400 to the client instead of an unhandled 500.
 */
export async function resolveAiApiKey(userId: string, userEmail: string): Promise<string> {
  const role = await getUserRole(userEmail);

  if (usesEnvApiKey(role)) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error("GEMINI_API_KEY environment variable is not set");
    return key;
  }

  const [settings] = await db
    .select({ encryptedApiKey: userSettings.encryptedApiKey })
    .from(userSettings)
    .where(eq(userSettings.userId, userId));

  if (!settings?.encryptedApiKey) {
    throw new Error("No API key configured. Please add your Gemini API key in Settings.");
  }

  return decryptApiKey(settings.encryptedApiKey);
}
