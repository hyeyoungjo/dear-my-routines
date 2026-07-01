import { and, eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { tasks, type NewTask } from "@/db/schema";
import { createClient } from "@/services/supabase/server";

/**
 * Pick only the fields a client may patch on a task. `taskId`/`userId` are never
 * accepted. `projectId` may be set or cleared to null (assign / unassign).
 * `shelvedAt` (ADR-026) is set to an ISO string when shelving, or null when
 * un-shelving; it arrives over the wire as a string or null.
 */
function parseTaskPatchInput(body: Record<string, unknown>): Partial<NewTask> {
  const values: Partial<NewTask> = {};
  if (typeof body.title === "string") values.title = body.title;
  if (typeof body.projectId === "string") {
    values.projectId = body.projectId;
  } else if (body.projectId === null) {
    values.projectId = null;
  }
  if (typeof body.notes === "string") values.notes = body.notes;
  else if (body.notes === null) values.notes = null;
  if (typeof body.category === "string") values.category = body.category;
  else if (body.category === null) values.category = null;
  if (typeof body.shelvedAt === "string") {
    values.shelvedAt = new Date(body.shelvedAt);
  } else if (body.shelvedAt === null) {
    values.shelvedAt = null;
  }
  return values;
}

/** PATCH /api/tasks/[id] — partial update of one task the user owns. */
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

  const values = parseTaskPatchInput(body);
  if (Object.keys(values).length === 0) {
    return NextResponse.json({ error: "No updatable fields" }, { status: 400 });
  }

  const [updated] = await db
    .update(tasks)
    .set({ ...values, updatedOn: new Date() })
    .where(and(eq(tasks.taskId, id), eq(tasks.userId, user.id)))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(updated);
}

/** DELETE /api/tasks/[id] — delete one task the user owns (plans/actions cascade). */
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
    .delete(tasks)
    .where(and(eq(tasks.taskId, id), eq(tasks.userId, user.id)))
    .returning({ taskId: tasks.taskId });

  if (!deleted) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ taskId: deleted.taskId });
}
