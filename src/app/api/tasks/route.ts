import { eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { actionBlocks, planBlocks, tasks, type NewTask } from "@/db/schema";
import { createClient } from "@/services/supabase/server";

/**
 * Pick only the fields a client may set when creating a task (ADR-016).
 * `userId` is NOT accepted — the server injects it from the session (ADR-003/010,
 * RLS). `taskId` IS accepted: the client mints it so a task and its first block
 * can be created (and rendered optimistically) under the same id in one shot —
 * the server honours it instead of `defaultRandom`. `projectId` is optional.
 */
function parseTaskCreateInput(
  body: Record<string, unknown>,
): Omit<NewTask, "userId"> | { error: string } {
  const { title } = body;
  if (typeof title !== "string") return { error: "title must be a string" };

  const values: Omit<NewTask, "userId"> = { title };
  if (typeof body.taskId === "string") values.taskId = body.taskId;
  if (typeof body.projectId === "string") values.projectId = body.projectId;
  if (typeof body.notes === "string") values.notes = body.notes;
  if (typeof body.category === "string") values.category = body.category;
  return values;
}

/** A block span sent alongside a task create (its first plan/action). */
type BlockSpan = { date: string; startAt: Date; endAt: Date | null };

/** Validate an optional `plan`/`action` payload on the task-create body. */
function parseBlockSpan(raw: unknown): BlockSpan | null {
  if (!raw || typeof raw !== "object") return null;
  const b = raw as Record<string, unknown>;
  if (typeof b.date !== "string" || typeof b.startAt !== "string") return null;
  return {
    date: b.date,
    startAt: new Date(b.startAt),
    endAt: typeof b.endAt === "string" ? new Date(b.endAt) : null,
  };
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

/**
 * POST /api/tasks — create a task owned by the user. If the body carries a
 * `plan` or `action` span, the task AND that first block are created together in
 * a single transaction (FK-safe, one round-trip) and returned as
 * `{ task, planBlock, actionBlock }`. With neither, the bare task row is returned
 * (back-compat with a plain task create).
 */
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

  const plan = parseBlockSpan(body.plan);
  const action = parseBlockSpan(body.action);

  // Plain task create (no block) — keep the bare-task response shape.
  if (!plan && !action) {
    const [created] = await db
      .insert(tasks)
      .values({ ...parsed, userId: user.id })
      .returning();
    return NextResponse.json(created, { status: 201 });
  }

  // Task + its first block, atomically, so the block's FK to the task can never
  // race ahead of the task's own insert.
  const result = await db.transaction(async (tx) => {
    const [task] = await tx
      .insert(tasks)
      .values({ ...parsed, userId: user.id })
      .returning();

    let planBlock = null;
    let actionBlock = null;
    if (plan && plan.endAt) {
      [planBlock] = await tx
        .insert(planBlocks)
        .values({
          taskId: task.taskId,
          userId: user.id,
          date: plan.date,
          startAt: plan.startAt,
          endAt: plan.endAt,
          status: "planned",
        })
        .returning();
    }
    if (action) {
      [actionBlock] = await tx
        .insert(actionBlocks)
        .values({
          taskId: task.taskId,
          userId: user.id,
          date: action.date,
          startAt: action.startAt,
          endAt: action.endAt,
        })
        .returning();
    }
    return { task, planBlock, actionBlock };
  });

  return NextResponse.json(result, { status: 201 });
}
