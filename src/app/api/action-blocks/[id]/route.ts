import { and, eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { actionBlocks, type NewActionBlock } from "@/db/schema";
import { createClient } from "@/services/supabase/server";

const ACTION_STATUSES = ["in-progress", "done"] as const;

/**
 * Pick only the fields a client may patch on an action_block. `actionBlockId`,
 * `userId`, and `taskId` are never accepted. `startAt` can move (not clear);
 * `endAt` can be set or cleared to null (finishing or reopening a span); status
 * is in-progress|done.
 */
function parseActionPatchInput(
  body: Record<string, unknown>,
): Partial<NewActionBlock> {
  const values: Partial<NewActionBlock> = {};

  // date moves with a reschedule (an action owns its own day, see core/time/action).
  if (typeof body.date === "string") values.date = body.date;
  if (typeof body.startAt === "string") values.startAt = new Date(body.startAt);
  if (typeof body.endAt === "string") {
    values.endAt = new Date(body.endAt);
  } else if (body.endAt === null) {
    values.endAt = null;
  }
  if (
    typeof body.status === "string" &&
    ACTION_STATUSES.includes(body.status as never)
  ) {
    values.status = body.status as NewActionBlock["status"];
  }

  return values;
}

/** PATCH /api/action-blocks/[id] — partial update of one action the user owns. */
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

  const values = parseActionPatchInput(body);
  if (Object.keys(values).length === 0) {
    return NextResponse.json({ error: "No updatable fields" }, { status: 400 });
  }

  const [updated] = await db
    .update(actionBlocks)
    .set({ ...values, updatedOn: new Date() })
    .where(
      and(eq(actionBlocks.actionBlockId, id), eq(actionBlocks.userId, user.id)),
    )
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(updated);
}

/** DELETE /api/action-blocks/[id] — delete one action the user owns. */
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
    .delete(actionBlocks)
    .where(
      and(eq(actionBlocks.actionBlockId, id), eq(actionBlocks.userId, user.id)),
    )
    .returning({ actionBlockId: actionBlocks.actionBlockId });

  if (!deleted) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ actionBlockId: deleted.actionBlockId });
}
