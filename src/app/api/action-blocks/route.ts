import { eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { actionBlocks, type NewActionBlock } from "@/db/schema";
import { createClient } from "@/services/supabase/server";

/**
 * Pick only the fields a client may set when creating an action_block
 * (ADR-015/016). `actionBlockId`/`userId` are NOT accepted — the server injects
 * `userId` from the session (ADR-003/010, RLS). `startAt` is required; `endAt`
 * is optional (a still-running span has no end yet).
 */
function parseActionCreateInput(
  body: Record<string, unknown>,
): Omit<NewActionBlock, "userId"> | { error: string } {
  const { taskId, date, startAt } = body;
  if (typeof taskId !== "string") return { error: "taskId must be a string" };
  if (typeof date !== "string") {
    return { error: "date must be a string (YYYY-MM-DD)" };
  }
  if (typeof startAt !== "string") {
    return { error: "startAt must be an ISO string" };
  }

  const values: Omit<NewActionBlock, "userId"> = {
    taskId,
    date,
    startAt: new Date(startAt),
  };
  if (typeof body.endAt === "string") values.endAt = new Date(body.endAt);
  // The plan this action was confirmed from (ghost click, ADR-030) — optional,
  // absent for directly-created actions.
  if (typeof body.planBlockId === "string") {
    values.planBlockId = body.planBlockId;
  }

  return values;
}

/** GET /api/action-blocks — all action_blocks owned by the user (flat array). */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await db
    .select()
    .from(actionBlocks)
    .where(eq(actionBlocks.userId, user.id));
  return NextResponse.json(rows);
}

/** POST /api/action-blocks — create an action_block owned by the user. */
export async function POST(request: NextRequest) {
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

  const parsed = parseActionCreateInput(body);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const [created] = await db
    .insert(actionBlocks)
    .values({ ...parsed, userId: user.id })
    .returning();

  return NextResponse.json(created, { status: 201 });
}
