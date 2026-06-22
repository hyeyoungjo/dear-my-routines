import { eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { tasks, type NewTask } from "@/db/schema";
import { createClient } from "@/services/supabase/server";

/**
 * Pick only the fields a client may set when creating a task (ADR-016).
 * `taskId`/`userId` are NOT accepted — the server injects `userId` from the
 * session (ADR-003/010, RLS). `projectId` is optional (unassigned task).
 */
function parseTaskCreateInput(
  body: Record<string, unknown>,
): Omit<NewTask, "userId"> | { error: string } {
  const { title } = body;
  if (typeof title !== "string") return { error: "title must be a string" };

  const values: Omit<NewTask, "userId"> = { title };
  if (typeof body.projectId === "string") values.projectId = body.projectId;
  if (typeof body.notes === "string") values.notes = body.notes;
  if (typeof body.category === "string") values.category = body.category;
  return values;
}

/** GET /api/tasks — all tasks owned by the user (flat array). */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await db.select().from(tasks).where(eq(tasks.userId, user.id));
  return NextResponse.json(rows);
}

/** POST /api/tasks — create a task owned by the user. */
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

  const parsed = parseTaskCreateInput(body);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const [created] = await db
    .insert(tasks)
    .values({ ...parsed, userId: user.id })
    .returning();

  return NextResponse.json(created, { status: 201 });
}
