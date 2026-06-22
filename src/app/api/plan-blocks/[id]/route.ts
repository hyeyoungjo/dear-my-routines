import { and, eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { planBlocks, type NewPlanBlock } from "@/db/schema";
import { createClient } from "@/services/supabase/server";

const PLAN_STATUSES = ["planned", "missed"] as const;

/**
 * Pick only the fields a client may patch on a plan_block, validating the status
 * enum. `id`, `userId`, and `nodeId` (a plan never changes the task it belongs
 * to) are never accepted. `startAt`/`endAt` are notNull, so they can be moved
 * but not cleared.
 */
function parsePlanPatchInput(body: Record<string, unknown>): Partial<NewPlanBlock> {
  const values: Partial<NewPlanBlock> = {};

  // gridDay is a `date` string (moves with a reschedule/carry, see core/plan).
  if (typeof body.gridDay === "string") values.gridDay = body.gridDay;
  // Spans arrive as ISO strings (drag/resize); Drizzle timestamps want Dates.
  if (typeof body.startAt === "string") values.startAt = new Date(body.startAt);
  if (typeof body.endAt === "string") values.endAt = new Date(body.endAt);
  if (
    typeof body.status === "string" &&
    PLAN_STATUSES.includes(body.status as never)
  ) {
    values.status = body.status as NewPlanBlock["status"];
  }

  return values;
}

/** PATCH /api/plan-blocks/[id] — partial update of one plan the user owns. */
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

  const values = parsePlanPatchInput(body);
  if (Object.keys(values).length === 0) {
    return NextResponse.json({ error: "No updatable fields" }, { status: 400 });
  }

  const [updated] = await db
    .update(planBlocks)
    .set({ ...values, updatedAt: new Date() })
    .where(and(eq(planBlocks.id, id), eq(planBlocks.userId, user.id)))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(updated);
}

/** DELETE /api/plan-blocks/[id] — delete one plan the user owns. */
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
    .delete(planBlocks)
    .where(and(eq(planBlocks.id, id), eq(planBlocks.userId, user.id)))
    .returning({ id: planBlocks.id });

  if (!deleted) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ id: deleted.id });
}
