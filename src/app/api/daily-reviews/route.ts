import { and, eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { dailyReviews } from "@/db/schema";
import { createClient } from "@/services/supabase/server";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Parse + validate the PUT body. `userId` is intentionally NOT accepted — the
 * server injects it from the authenticated session (never trust a client-supplied
 * owner; ADR-003, RLS). `aiAnalysis` is out of scope this phase and never touched.
 */
function parseUpsertInput(
  body: Record<string, unknown>,
): { date: string; journalText: string } | { error: string } {
  const { date, journalText } = body;
  if (typeof date !== "string" || !DATE_RE.test(date)) {
    return { error: "date must be a string (YYYY-MM-DD)" };
  }
  if (typeof journalText !== "string") {
    return { error: "journalText must be a string" };
  }
  return { date, journalText };
}

/**
 * GET /api/daily-reviews?date=YYYY-MM-DD
 * → the review row for that grid day, or `null` (200) if none exists.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const date = request.nextUrl.searchParams.get("date");
  if (typeof date !== "string" || !DATE_RE.test(date)) {
    return NextResponse.json(
      { error: "date must be a string (YYYY-MM-DD)" },
      { status: 400 },
    );
  }

  const [row] = await db
    .select()
    .from(dailyReviews)
    .where(and(eq(dailyReviews.userId, user.id), eq(dailyReviews.date, date)));

  return NextResponse.json(row ?? null);
}

/**
 * PUT /api/daily-reviews
 * body: { date: YYYY-MM-DD, journalText: string }
 * → upsert on (userId, date): updates `journal_text` if a row exists, else
 *   inserts. `ai_analysis` is left untouched so a prior analysis is never
 *   overwritten. Returns the upserted row.
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

  const parsed = parseUpsertInput(body);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const [upserted] = await db
    .insert(dailyReviews)
    .values({
      userId: user.id,
      date: parsed.date,
      journalText: parsed.journalText,
    })
    .onConflictDoUpdate({
      target: [dailyReviews.userId, dailyReviews.date],
      set: { journalText: parsed.journalText },
    })
    .returning();

  return NextResponse.json(upserted);
}
