import { eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { userSettings } from "@/db/schema";
import { isAllowedModel } from "@/services/ai/models";
import { isAllowedLanguage } from "@/lib/languages";
import { isAllowedFont } from "@/lib/fonts";
import { createClient } from "@/services/supabase/server";

/**
 * GET /api/user-settings
 * → the settings row for the current user, or `null` (200) if none exists.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [row] = await db
    .select()
    .from(userSettings)
    .where(eq(userSettings.userId, user.id));

  return NextResponse.json(row ?? null);
}

/**
 * PUT /api/user-settings
 * body: { aiModel: string | null }
 * → upsert on (userId): updates ai_model if a row exists, else inserts.
 *   `aiModel` must be an allowed model id or null (resets to env default).
 *   Returns the upserted row.
 */
export async function PUT(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { aiModel, aiEnabled, language, font, gridStartTime, gridEndTime } = body;

  // null = reset to default; string = must be an allowed model id
  if (aiModel !== null && aiModel !== undefined) {
    if (typeof aiModel !== "string") {
      return NextResponse.json(
        { error: "aiModel must be a string or null" },
        { status: 400 },
      );
    }
    if (!isAllowedModel(aiModel)) {
      return NextResponse.json(
        { error: `aiModel "${aiModel}" is not an allowed model` },
        { status: 400 },
      );
    }
  }

  if (aiEnabled !== undefined && typeof aiEnabled !== "boolean") {
    return NextResponse.json(
      { error: "aiEnabled must be a boolean" },
      { status: 400 },
    );
  }

  if (language !== undefined && language !== null) {
    if (typeof language !== "string" || !isAllowedLanguage(language)) {
      return NextResponse.json(
        { error: `language "${language}" is not supported` },
        { status: 400 },
      );
    }
  }

  if (font !== undefined && font !== null) {
    if (typeof font !== "string" || !isAllowedFont(font)) {
      return NextResponse.json(
        { error: `font "${font}" is not supported` },
        { status: 400 },
      );
    }
  }

  if (gridStartTime !== undefined && gridStartTime !== null) {
    if (typeof gridStartTime !== "number" || !Number.isInteger(gridStartTime) || gridStartTime < 0 || gridStartTime > 23) {
      return NextResponse.json({ error: "gridStartTime must be an integer 0–23" }, { status: 400 });
    }
  }
  if (gridEndTime !== undefined && gridEndTime !== null) {
    if (typeof gridEndTime !== "number" || !Number.isInteger(gridEndTime) || gridEndTime < 1 || gridEndTime > 30) {
      return NextResponse.json({ error: "gridEndTime must be an integer 1–30" }, { status: 400 });
    }
  }

  const [upserted] = await db
    .insert(userSettings)
    .values({
      userId: user.id,
      aiModel: (aiModel as string | null) ?? null,
      aiEnabled: (aiEnabled as boolean | undefined) ?? false,
      language: (language as string | null | undefined) ?? null,
      font: (font as string | null | undefined) ?? null,
      gridStartTime: (gridStartTime as number | null | undefined) ?? null,
      gridEndTime: (gridEndTime as number | null | undefined) ?? null,
    })
    .onConflictDoUpdate({
      target: userSettings.userId,
      set: {
        ...(aiModel !== undefined && { aiModel: aiModel as string | null }),
        ...(aiEnabled !== undefined && { aiEnabled: aiEnabled as boolean }),
        ...(language !== undefined && { language: language as string | null }),
        ...(font !== undefined && { font: font as string | null }),
        ...(gridStartTime !== undefined && { gridStartTime: gridStartTime as number | null }),
        ...(gridEndTime !== undefined && { gridEndTime: gridEndTime as number | null }),
        updatedOn: new Date(),
      },
    })
    .returning();

  return NextResponse.json(upserted);
}
