import { and, eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { projects, type NewProject } from "@/db/schema";
import { createClient } from "@/services/supabase/server";

/**
 * Pick only the fields a client may patch on a project. `projectId`/`userId`
 * are never accepted.
 */
function parseProjectPatchInput(
  body: Record<string, unknown>,
): Partial<NewProject> {
  const values: Partial<NewProject> = {};
  if (typeof body.title === "string") values.title = body.title;
  if (typeof body.projectColor === "string") {
    values.projectColor = body.projectColor;
  } else if (body.projectColor === null) {
    values.projectColor = null;
  }
  return values;
}

/** PATCH /api/projects/[id] — partial update of one project the user owns. */
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

  const values = parseProjectPatchInput(body);
  if (Object.keys(values).length === 0) {
    return NextResponse.json({ error: "No updatable fields" }, { status: 400 });
  }

  const [updated] = await db
    .update(projects)
    .set({ ...values, updatedOn: new Date() })
    .where(and(eq(projects.projectId, id), eq(projects.userId, user.id)))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(updated);
}

/** DELETE /api/projects/[id] — delete one project the user owns (tasks unassign). */
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
    .delete(projects)
    .where(and(eq(projects.projectId, id), eq(projects.userId, user.id)))
    .returning({ projectId: projects.projectId });

  if (!deleted) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ projectId: deleted.projectId });
}
