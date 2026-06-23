import { and, eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { taskBlocks, type NewTaskBlock } from "@/db/schema";
import { createClient } from "@/services/supabase/server";

const BLOCK_STATUSES = ["planned", "done", "missed"] as const;

/**
 * Pick only the fields a client may patch, validating the status enum. `id`,
 * `userId`, and `nodeId` (a block never changes the task it belongs to) are
 * never accepted from the body.
 */
function parseBlockPatchInput(body: Record<string, unknown>): Partial<NewTaskBlock> {
  const values: Partial<NewTaskBlock> = {};

  // gridDay is a `date` string (moves with a reschedule/carry, see core/blocks).
  if (typeof body.gridDay === "string") values.gridDay = body.gridDay;
  // Time spans arrive as ISO strings (drag/resize); Drizzle wants Dates. null clears.
  if (typeof body.plannedStart === "string") {
    values.plannedStart = new Date(body.plannedStart);
  } else if (body.plannedStart === null) {
    values.plannedStart = null;
  }
  if (typeof body.plannedEnd === "string") {
    values.plannedEnd = new Date(body.plannedEnd);
  } else if (body.plannedEnd === null) {
    values.plannedEnd = null;
  }
  if (typeof body.actualStart === "string") {
    values.actualStart = new Date(body.actualStart);
  } else if (body.actualStart === null) {
    values.actualStart = null;
  }
  if (typeof body.actualEnd === "string") {
    values.actualEnd = new Date(body.actualEnd);
  } else if (body.actualEnd === null) {
    values.actualEnd = null;
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

/** PATCH /api/blocks/[id] — partial update of one block the user owns. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
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

  const values = parseBlockPatchInput(body);
  if (Object.keys(values).length === 0) {
    return NextResponse.json({ error: "No updatable fields" }, { status: 400 });
  }

  const [updated] = await db
    .update(taskBlocks)
    .set({ ...values, updatedAt: new Date() })
    .where(and(eq(taskBlocks.id, id), eq(taskBlocks.userId, user.id)))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(updated);
}

/** DELETE /api/blocks/[id] — delete one block the user owns. */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [deleted] = await db
    .delete(taskBlocks)
    .where(and(eq(taskBlocks.id, id), eq(taskBlocks.userId, user.id)))
    .returning({ id: taskBlocks.id });

  if (!deleted) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ id: deleted.id });
}
