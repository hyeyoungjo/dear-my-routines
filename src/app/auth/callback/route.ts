import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/services/supabase/server";

/**
 * Magic-link callback. Supabase redirects here with a `code` query param;
 * we exchange it for a session (cookies are set via the server client) and
 * send the user to the home page.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}/`);
    }
  }

  // No code or exchange failed — back to login.
  return NextResponse.redirect(`${origin}/login`);
}
