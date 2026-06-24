import { and, eq, gte, inArray, lte } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { buildDailyReviewPrompt, type ReviewTaskInput } from "@/core/ai/dailyReviewPrompt";
import type { TaskRatio } from "@/core/ai/schema";
import { clampHistoryDays, summarizeReviewHistory } from "@/core/ai/reviewHistory";
import { dailyAnalysisSchema, type DailyAnalysis } from "@/core/ai/schema";
import { buildExportRows } from "@/core/export";
import { addDays, dayFromKey, dayKey } from "@/core/time/day";
import { db } from "@/db";
import {
  actionBlocks,
  dailyReviews,
  planBlocks,
  projects,
  tasks,
  userSettings,
} from "@/db/schema";
import { languageLabel } from "@/lib/languages";
import { generateStructured } from "@/services/ai";
import { resolveModelId } from "@/services/ai/models";
import { loadDailyReviewTemplates } from "@/services/ai/prompts";
import { resolveAiApiKey } from "@/services/ai/resolveApiKey";
import { createClient } from "@/services/supabase/server";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * POST /api/daily-reviews/analyze
 * body: { date: YYYY-MM-DD }
 *
 * Generates an AI review for one grid day and stores it on the day's
 * `daily_reviews.ai_analysis`. Pulls the journal + that day's plan/action
 * blocks, builds the prompt (core), calls Gemini through the AI SDK (services),
 * and upserts the validated result. Returns the updated review row.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const date = body.date;
  if (typeof date !== "string" || !DATE_RE.test(date)) {
    return NextResponse.json(
      { error: "date must be a string (YYYY-MM-DD)" },
      { status: 400 },
    );
  }

  // Resolve the user's key (env for admin/tester, decrypted own key otherwise).
  // A missing key is a user-actionable 400, not a server error.
  let apiKey: string;
  try {
    apiKey = await resolveAiApiKey(user.id, user.email);
  } catch (err) {
    const message = err instanceof Error ? err.message : "No API key available";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  // Preferred model (null → env GEMINI_MODEL default) and UI language: the AI
  // answers in the language the user chose for the interface (null → default).
  const [settings] = await db
    .select({
      aiModel: userSettings.aiModel,
      language: userSettings.language,
      reviewStylePrompt: userSettings.reviewStylePrompt,
      reviewHistoryDays: userSettings.reviewHistoryDays,
    })
    .from(userSettings)
    .where(eq(userSettings.userId, user.id));
  const modelId = resolveModelId(settings?.aiModel);
  const language = languageLabel(settings?.language);
  const customStyle = settings?.reviewStylePrompt ?? "";
  const historyDays = clampHistoryDays(settings?.reviewHistoryDays);

  // The journal for the day (may not exist yet — empty journal is allowed).
  const [review] = await db
    .select()
    .from(dailyReviews)
    .where(and(eq(dailyReviews.userId, user.id), eq(dailyReviews.date, date)));
  const journalText = review?.journalText ?? "";

  // That day's plan + action spans, grouped per task.
  const [plans, actions] = await Promise.all([
    db
      .select()
      .from(planBlocks)
      .where(and(eq(planBlocks.userId, user.id), eq(planBlocks.date, date))),
    db
      .select()
      .from(actionBlocks)
      .where(and(eq(actionBlocks.userId, user.id), eq(actionBlocks.date, date))),
  ]);

  const taskIds = [
    ...new Set([...plans.map((p) => p.taskId), ...actions.map((a) => a.taskId)]),
  ];

  const reviewTasks = await buildReviewTasks(user.id, taskIds, plans, actions);

  // Trailing window of prior days (strictly before `date`) condensed into a
  // short pattern block — chronic under-estimation / repeated deferral that a
  // single day cannot reveal. Reuses the export roll-up so the figures match
  // exactly what the user sees in their CSV.
  const history = await buildReviewHistory(user.id, date, historyDays);

  const templates = await loadDailyReviewTemplates();
  const { system, prompt } = buildDailyReviewPrompt(
    { date, journalText, tasks: reviewTasks, language, history, customStyle },
    templates,
  );

  let analysis: DailyAnalysis;
  try {
    analysis = await generateStructured<DailyAnalysis>({
      modelId,
      apiKey,
      schema: dailyAnalysisSchema,
      system,
      prompt,
    });
  } catch (err) {
    console.error("Daily review generation failed:", err);
    return NextResponse.json(
      { error: "AI analysis failed. Please try again." },
      { status: 502 },
    );
  }

  const stored: DailyAnalysis = {
    ...analysis,
    taskRatios: computeTaskRatios(reviewTasks),
    generatedAt: new Date().toISOString(),
  };

  // Upsert: attach the analysis to the day's row, leaving journalText intact
  // (or seeding it empty if the user analyzed before writing a journal).
  const [saved] = await db
    .insert(dailyReviews)
    .values({ userId: user.id, date, journalText, aiAnalysis: stored })
    .onConflictDoUpdate({
      target: [dailyReviews.userId, dailyReviews.date],
      set: { aiAnalysis: stored },
    })
    .returning();

  return NextResponse.json(saved);
}

/**
 * Build the condensed trailing-history block for the prompt. Pulls the window
 * `[date - days, date - 1]` (prior days only — the reviewed day is already in
 * the per-task table) and runs it through the export roll-up + summarizer.
 * `allTaskPlanBlocks` is every plan for the user, which `buildExportRows` needs
 * to compute carry-over counts accurately.
 */
async function buildReviewHistory(
  userId: string,
  date: string,
  days: number,
): Promise<string> {
  const to = dayKey(addDays(dayFromKey(date), -1));
  const from = dayKey(addDays(dayFromKey(date), -days));

  const [taskRows, projectRows, planRows, actionRows, allPlanRows] =
    await Promise.all([
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
      db.select().from(planBlocks).where(eq(planBlocks.userId, userId)),
    ]);

  const rows = buildExportRows({
    tasks: taskRows,
    projects: projectRows,
    planBlocks: planRows,
    actionBlocks: actionRows,
    dailyReviews: [],
    allTaskPlanBlocks: allPlanRows,
  });

  return summarizeReviewHistory(rows, days);
}

type PlanRow = { taskId: string; startAt: Date; endAt: Date };
type ActionRow = { taskId: string; startAt: Date; endAt: Date | null };

/**
 * Join the day's plan/action rows with task identity (title, category, project)
 * into the shape the prompt builder consumes — one entry per task that had any
 * plan or action that day.
 */
async function buildReviewTasks(
  userId: string,
  taskIds: string[],
  plans: PlanRow[],
  actions: ActionRow[],
): Promise<ReviewTaskInput[]> {
  if (taskIds.length === 0) return [];

  const taskRows = await db
    .select({
      taskId: tasks.taskId,
      title: tasks.title,
      category: tasks.category,
      projectTitle: projects.title,
    })
    .from(tasks)
    .leftJoin(projects, eq(tasks.projectId, projects.projectId))
    .where(and(eq(tasks.userId, userId), inArray(tasks.taskId, taskIds)));

  return taskRows.map((t) => ({
    taskTitle: t.title,
    projectTitle: t.projectTitle,
    category: t.category,
    plans: plans
      .filter((p) => p.taskId === t.taskId)
      .map((p) => ({ startAt: p.startAt.toISOString(), endAt: p.endAt.toISOString() })),
    actions: actions
      .filter((a) => a.taskId === t.taskId)
      .map((a) => ({
        startAt: a.startAt.toISOString(),
        endAt: a.endAt ? a.endAt.toISOString() : null,
      })),
  }));
}

/** Format a duration in minutes to a human-readable string ("1h", "45m", "1h 30m"). */
function formatMins(mins: number): string {
  if (mins < 60) return `${Math.round(mins)}m`;
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/**
 * Compute per-task estimated vs. actual durations from plan/action timestamps.
 * Calculated server-side so the numbers are exact, not AI-hallucinated.
 * Tasks with no plans are skipped; tasks with no completed actions show "—".
 */
function computeTaskRatios(tasks: ReviewTaskInput[]): TaskRatio[] {
  return tasks.flatMap((task) => {
    if (!task.plans.length) return [];
    const estMins = task.plans.reduce((sum, p) => {
      return sum + (new Date(p.endAt).getTime() - new Date(p.startAt).getTime()) / 60_000;
    }, 0);
    if (estMins <= 0) return [];
    const actMins = task.actions
      .filter((a) => a.endAt !== null)
      .reduce((sum, a) => {
        return sum + (new Date(a.endAt!).getTime() - new Date(a.startAt).getTime()) / 60_000;
      }, 0);
    return [
      {
        name: task.taskTitle || "Untitled",
        estimated: formatMins(estMins),
        actual: actMins > 0 ? formatMins(actMins) : "—",
      },
    ];
  });
}
