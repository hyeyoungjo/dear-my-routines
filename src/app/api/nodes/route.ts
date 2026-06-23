import { eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { nodes, type NewNode } from "@/db/schema";
import { createClient } from "@/services/supabase/server";

const NODE_TYPES = ["area", "project", "task", "subtask"] as const;

/**
 * Pick only the fields a client may set when creating a node, validating the
 * enums. `userId` is intentionally NOT accepted here — the server injects it
 * from the authenticated session (never trust a client-supplied owner).
 */
function parseCreateInput(
  body: Record<string, unknown>,
): Omit<NewNode, "userId"> | { error: string } {
  const { title, type } = body;
  // Allow an empty title: new blocks start blank so the UI shows a placeholder
  // ("New subtask" etc.) and the user types straight in — no clearing needed.
  if (typeof title !== "string") {
    return { error: "title must be a string" };
  }
  if (typeof type !== "string" || !NODE_TYPES.includes(type as never)) {
    return { error: "type must be one of area|project|task|subtask" };
  }

  const values: Omit<NewNode, "userId"> = {
    title,
    type: type as NewNode["type"],
  };

  if (typeof body.parentId === "string") values.parentId = body.parentId;
  if (typeof body.color === "string") values.color = body.color;
  if (typeof body.notes === "string") values.notes = body.notes;
  if (Array.isArray(body.links)) {
    values.links = body.links.filter((l): l is string => typeof l === "string");
  }
  if (typeof body.estimateMinutes === "number") {
    values.estimateMinutes = body.estimateMinutes;
  }
  if (typeof body.category === "string") values.category = body.category;
  if (typeof body.isBig3 === "boolean") values.isBig3 = body.isBig3;
  if (typeof body.sortOrder === "number") values.sortOrder = body.sortOrder;

  return values;
}

/** GET /api/nodes — all nodes owned by the authenticated user (flat array). */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await db.select().from(nodes).where(eq(nodes.userId, user.id));
  return NextResponse.json(rows);
}

/** POST /api/nodes — create a node owned by the authenticated user. */
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

  const parsed = parseCreateInput(body);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const [created] = await db
    .insert(nodes)
    .values({ ...parsed, userId: user.id })
    .returning();

  return NextResponse.json(created, { status: 201 });
}
