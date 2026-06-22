import { eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { planBlocks, type NewPlanBlock } from "@/db/schema";
import { createClient } from "@/services/supabase/server";

const PLAN_STATUSES = ["planned", "missed"] as const;

/**
 * Pick only the fields a client may set when creating a plan_block (ADR-015/016),
 * validating the status enum. `planBlockId`/`userId` are intentionally NOT
 * accepted — the server injects `userId` from the authenticated session (never
 * trust a client-supplied owner; ADR-003/010, RLS). A plan is always a box, so
 * `startAt`/`endAt` are required.
 */
function parsePlanCreateInput(
  body: Record<string, unknown>,
): Omit<NewPlanBlock, "userId"> | { error: string } {
  const { taskId, date, startAt, endAt } = body;
  if (typeof taskId !== "string") return { error: "taskId must be a string" };
  if (typeof date !== "string") {
    return { error: "date must be a string (YYYY-MM-DD)" };
  }
  if (typeof startAt !== "string") {
    return { error: "startAt must be an ISO string" };
  }
  if (typeof endAt !== "string") {
    return { error: "endAt must be an ISO string" };
  }

  const values: Omit<NewPlanBlock, "userId"> = {
    taskId,
    date,
    startAt: new Date(startAt),
    endAt: new Date(endAt),
  };
  if (
    typeof body.status === "string" &&
    PLAN_STATUSES.includes(body.status as never)
  ) {
    values.status = body.status as NewPlanBlock["status"];
  }

  return values;
}

/** GET /api/plan-blocks — all plan_blocks owned by the user (flat array). */
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
    .from(planBlocks)
    .where(eq(planBlocks.userId, user.id));
  return NextResponse.json(rows);
}

/** POST /api/plan-blocks — create a plan_block owned by the user. */
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

  const parsed = parsePlanCreateInput(body);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const [created] = await db
    .insert(planBlocks)
    .values({ ...parsed, userId: user.id })
    .returning();

  return NextResponse.json(created, { status: 201 });
}
