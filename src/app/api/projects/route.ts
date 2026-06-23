import { eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { projects, type NewProject } from "@/db/schema";
import { createClient } from "@/services/supabase/server";

/**
 * Pick only the fields a client may set when creating a project (ADR-016).
 * `projectId`/`userId` are NOT accepted — the server injects `userId` from the
 * session (ADR-003/010, RLS).
 */
function parseProjectCreateInput(
  body: Record<string, unknown>,
): Omit<NewProject, "userId"> | { error: string } {
  const { title } = body;
  if (typeof title !== "string") return { error: "title must be a string" };

  const values: Omit<NewProject, "userId"> = { title };
  if (typeof body.projectColor === "string") {
    values.projectColor = body.projectColor;
  }
  return values;
}

/** GET /api/projects — all projects owned by the user (flat array). */
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
    .from(projects)
    .where(eq(projects.userId, user.id));
  return NextResponse.json(rows);
}

/** POST /api/projects — create a project owned by the user. */
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

  const parsed = parseProjectCreateInput(body);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const [created] = await db
    .insert(projects)
    .values({ ...parsed, userId: user.id })
    .returning();

  return NextResponse.json(created, { status: 201 });
}
