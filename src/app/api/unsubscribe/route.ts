import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { emailUnsubscribes } from "@/db/schema";
import { verifyUnsubscribeToken } from "@/lib/unsubscribe";

/**
 * One-click email unsubscribe (ADR-029). No auth — a recipient clicking the link
 * may not be logged in — so the HMAC token (verifyUnsubscribeToken) is what proves
 * the request is legitimate and prevents unsubscribing someone else. The insert is
 * idempotent (onConflictDoNothing). GET shows a confirmation page (user click);
 * POST is the RFC 8058 one-click path Gmail/Yahoo call from List-Unsubscribe-Post.
 * Writes go through the server `db` connection, which bypasses the table's RLS
 * (enabled with no policies, so clients can't touch it).
 */
async function tryUnsubscribe(email: string, token: string): Promise<boolean> {
  if (!email || !token) return false;
  if (!verifyUnsubscribeToken(email, token)) return false;
  await db
    .insert(emailUnsubscribes)
    .values({ email: email.trim().toLowerCase() })
    .onConflictDoNothing();
  return true;
}

function paramsOf(request: NextRequest): { email: string; token: string } {
  const { searchParams } = new URL(request.url);
  return { email: searchParams.get("e") ?? "", token: searchParams.get("t") ?? "" };
}

const page = (title: string, lines: string[]): string =>
  `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title></head><body style="font-family:-apple-system,'Segoe UI',Roboto,sans-serif;max-width:480px;margin:64px auto;padding:0 20px;text-align:center;color:#1a1a1a"><h1 style="font-size:18px;font-weight:600">${title}</h1>${lines
    .map((l) => `<p style="color:#666;line-height:1.6">${l}</p>`)
    .join("")}</body></html>`;

export async function GET(request: NextRequest) {
  const { email, token } = paramsOf(request);
  const ok = await tryUnsubscribe(email, token);
  const html = ok
    ? page("You've been unsubscribed", [
        "You will no longer receive update emails from Dear My Routines.",
        "더 이상 Dear My Routines 업데이트 이메일을 받지 않습니다.",
      ])
    : page("Invalid or expired link", [
        "This unsubscribe link is not valid.",
        "이 수신거부 링크가 유효하지 않습니다.",
      ]);
  return new NextResponse(html, {
    status: ok ? 200 : 400,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

export async function POST(request: NextRequest) {
  const { email, token } = paramsOf(request);
  const ok = await tryUnsubscribe(email, token);
  return NextResponse.json({ ok }, { status: ok ? 200 : 400 });
}
