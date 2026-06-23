import { NextResponse } from "next/server";

// TODO(step-4): implement full analyze route once ai + @ai-sdk/google + zod are installed.
// This stub returns 503 so the UI button shows an error rather than hanging.
export async function POST() {
  return NextResponse.json(
    { error: "AI analysis not yet available — packages pending install." },
    { status: 503 },
  );
}
