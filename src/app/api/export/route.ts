import { and, eq, gte, lte } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import {
  actionBlocks,
  dailyReviews,
  planBlocks,
  projects,
  tasks,
} from "@/db/schema";
import { buildExportRows } from "@/core/export";
import type { ExportRow } from "@/core/export";
import { createClient } from "@/services/supabase/server";
import { getUserRole } from "@/lib/userRole";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function escapeCSVField(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (
    str.includes(",") ||
    str.includes('"') ||
    str.includes("\n") ||
    str.includes("\r")
  ) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

const CSV_HEADERS: (keyof ExportRow)[] = [
  "date",
  "task_name",
  "project_name",
  "task_category",
  "completion_status",
  "planned_start_time",
  "planned_end_time",
  "planned_duration_min",
  "actual_start_time",
  "actual_end_time",
  "actual_duration_min",
  "duration_overrun_min",
  "times_carried_over",
  "daily_journal",
];

function rowsToCSV(rows: ExportRow[]): string {
  const lines = [CSV_HEADERS.join(",")];
  for (const row of rows) {
    lines.push(CSV_HEADERS.map((k) => escapeCSVField(row[k])).join(","));
  }
  return lines.join("\n");
}

/** GET /api/export?from=YYYY-MM-DD&to=YYYY-MM-DD */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = user.email ? await getUserRole(user.email) : "user";
  if (role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const from = request.nextUrl.searchParams.get("from");
  const to = request.nextUrl.searchParams.get("to");

  if (!from || !to) {
    return NextResponse.json(
      { error: "from and to query parameters are required" },
      { status: 400 },
    );
  }

  if (!DATE_RE.test(from) || !DATE_RE.test(to)) {
    return NextResponse.json(
      { error: "from and to must be in YYYY-MM-DD format" },
      { status: 400 },
    );
  }

  if (from > to) {
    return NextResponse.json(
      { error: "from must not be after to" },
      { status: 400 },
    );
  }

  const diffDays = Math.round(
    (new Date(to).getTime() - new Date(from).getTime()) / 86400000,
  );
  if (diffDays > 365) {
    return NextResponse.json(
      { error: "Date range must not exceed 365 days" },
      { status: 400 },
    );
  }

  const userId = user.id;

  const [
    taskRows,
    projectRows,
    planBlockRows,
    actionBlockRows,
    dailyReviewRows,
    allTaskPlanBlockRows,
  ] = await Promise.all([
    db.select().from(tasks).where(eq(tasks.userId, userId)),
    db.select().from(projects).where(eq(projects.userId, userId)),
    db
      .select()
      .from(planBlocks)
      .where(
        and(
          eq(planBlocks.userId, userId),
          gte(planBlocks.date, from),
          lte(planBlocks.date, to),
        ),
      ),
    db
      .select()
      .from(actionBlocks)
      .where(
        and(
          eq(actionBlocks.userId, userId),
          gte(actionBlocks.date, from),
          lte(actionBlocks.date, to),
        ),
      ),
    db
      .select()
      .from(dailyReviews)
      .where(
        and(
          eq(dailyReviews.userId, userId),
          gte(dailyReviews.date, from),
          lte(dailyReviews.date, to),
        ),
      ),
    db.select().from(planBlocks).where(eq(planBlocks.userId, userId)),
  ]);

  const rows = buildExportRows({
    tasks: taskRows,
    projects: projectRows,
    planBlocks: planBlockRows,
    actionBlocks: actionBlockRows,
    dailyReviews: dailyReviewRows,
    allTaskPlanBlocks: allTaskPlanBlockRows,
  });

  const csv = rowsToCSV(rows);

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="dear-my-routines-${from}-${to}.csv"`,
    },
  });
}
