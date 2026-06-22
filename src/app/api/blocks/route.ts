import { eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { taskBlocks, type NewTaskBlock } from "@/db/schema";
import { createClient } from "@/services/supabase/server";

const BLOCK_STATUSES = ["planned", "done", "missed"] as const;

/**
 * Pick only the fields a client may set when creating a task_block, validating
 * the status enum. `id`/`userId` are intentionally NOT accepted here — the
 * server injects `userId` from the authenticated session (never trust a
 * client-supplied owner; ADR-003/010, RLS).
 */
function parseBlockCreateInput(
  body: Record<string, unknown>,
): Omit<NewTaskBlock, "userId"> | { error: string } {
  const { nodeId, gridDay } = body;
  if (typeof nodeId !== "string") {
    return { error: "nodeId must be a string" };
  }
  // gridDay is a `date` column (YYYY-MM-DD), stored/read as a string.
  if (typeof gridDay !== "string") {
    return { error: "gridDay must be a string (YYYY-MM-DD)" };
  }

  const values: Omit<NewTaskBlock, "userId"> = { nodeId, gridDay };

  // Time spans arrive as ISO strings over the wire; Drizzle timestamps want Dates.
  if (typeof body.plannedStart === "string") {
    values.plannedStart = new Date(body.plannedStart);
  }
  if (typeof body.plannedEnd === "string") {
    values.plannedEnd = new Date(body.plannedEnd);
  }
  if (typeof body.actualStart === "string") {
    values.actualStart = new Date(body.actualStart);
  }
  if (typeof body.actualEnd === "string") {
    values.actualEnd = new Date(body.actualEnd);
  }
  if (
    typeof body.status === "string" &&
    BLOCK_STATUSES.includes(body.status as never)
  ) {
    values.status = body.status as NewTaskBlock["status"];
  }
  if (typeof body.sortOrder === "number") values.sortOrder = body.sortOrder;

  return values;
}

/** GET /api/blocks — all task_blocks owned by the authenticated user (flat array). */
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
    .from(taskBlocks)
    .where(eq(taskBlocks.userId, user.id));
  return NextResponse.json(rows);
}

/** POST /api/blocks — create a task_block owned by the authenticated user. */
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

  const parsed = parseBlockCreateInput(body);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const [created] = await db
    .insert(taskBlocks)
    .values({ ...parsed, userId: user.id })
    .returning();

  return NextResponse.json(created, { status: 201 });
}
