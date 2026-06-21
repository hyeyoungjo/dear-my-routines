import { and, eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { nodes, type NewNode } from "@/db/schema";
import { createClient } from "@/services/supabase/server";

const NODE_STATUSES = [
  "pending",
  "in_progress",
  "done",
  "carried",
  "dropped",
] as const;

/**
 * Pick only the fields a client may patch, validating the status enum. `id`,
 * `userId`, `type`, and timestamps are never accepted from the body.
 */
function parsePatchInput(body: Record<string, unknown>): Partial<NewNode> {
  const values: Partial<NewNode> = {};

  if (typeof body.title === "string" && body.title.trim() !== "") {
    values.title = body.title;
  }
  // parentId may be set to null (move to top level) or to another node's id.
  if (typeof body.parentId === "string" || body.parentId === null) {
    values.parentId = body.parentId;
  }
  if (typeof body.notes === "string" || body.notes === null) {
    values.notes = body.notes;
  }
  if (Array.isArray(body.links)) {
    values.links = body.links.filter((l): l is string => typeof l === "string");
  }
  if (typeof body.estimateMinutes === "number" || body.estimateMinutes === null) {
    values.estimateMinutes = body.estimateMinutes;
  }
  if (typeof body.actualMinutes === "number" || body.actualMinutes === null) {
    values.actualMinutes = body.actualMinutes;
  }
  if (
    typeof body.status === "string" &&
    NODE_STATUSES.includes(body.status as never)
  ) {
    values.status = body.status as NewNode["status"];
  }
  if (typeof body.category === "string" || body.category === null) {
    values.category = body.category;
  }
  if (typeof body.isBig3 === "boolean") values.isBig3 = body.isBig3;
  if (typeof body.plannedDate === "string" || body.plannedDate === null) {
    values.plannedDate = body.plannedDate;
  }
  if (typeof body.sortOrder === "number") values.sortOrder = body.sortOrder;

  return values;
}

/** PATCH /api/nodes/[id] — partial update of one node the user owns. */
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

  const values = parsePatchInput(body);
  if (Object.keys(values).length === 0) {
    return NextResponse.json({ error: "No updatable fields" }, { status: 400 });
  }

  const [updated] = await db
    .update(nodes)
    .set({ ...values, updatedAt: new Date() })
    .where(and(eq(nodes.id, id), eq(nodes.userId, user.id)))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(updated);
}

/**
 * DELETE /api/nodes/[id] — delete one node the user owns. Descendants are
 * removed automatically via the self-referencing `parent_id` ON DELETE CASCADE
 * (schema.ts); since children share the same owner, the userId filter on the
 * target row is enough to keep deletion isolated to this user.
 */
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
    .delete(nodes)
    .where(and(eq(nodes.id, id), eq(nodes.userId, user.id)))
    .returning({ id: nodes.id });

  if (!deleted) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ id: deleted.id });
}
