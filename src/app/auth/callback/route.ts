import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/services/supabase/server";

/**
 * Auth callback shared by magic-link and Google OAuth (ADR-011). In both
 * flows Supabase redirects here with a PKCE `code` query param; we exchange
 * it for a session (cookies are set via the server client) and send the
 * user to the home page.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  // Behind a reverse proxy (Railway), request.url's host is the internal bind
  // address (localhost:8080), so building redirects from `origin` would send the
  // browser there. Prefer the proxy's forwarded host — the real public domain.
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const base = forwardedHost
    ? `${forwardedProto ?? "https"}://${forwardedHost}`
    : origin;

  // Where to land after a successful exchange. Only same-origin relative paths
  // are honored (leading "/", but not "//host") to avoid open-redirects. The
  // password-recovery flow points here at "/auth/update-password".
  const nextParam = searchParams.get("next");
  const next =
    nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//")
      ? nextParam
      : "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${base}${next}`);
    }
  }

  // No code or exchange failed — back to login.
  return NextResponse.redirect(`${base}/login`);
}
