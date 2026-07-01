import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refreshes the Supabase session on every request and enforces single-user
 * route protection (ADR-003). Unauthenticated visitors are redirected to
 * /login; only /login and /auth/* are reachable while logged out.
 *
 * Cookie handling follows the official Supabase Next.js (App Router) guide:
 * the response must carry the refreshed cookies, so we rebuild it whenever
 * Supabase sets cookies and copy them onto any redirect we return.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANT: getUser() must run right after createServerClient — it triggers
  // the token refresh that writes fresh cookies onto supabaseResponse.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPublicRoute =
    pathname === "/login" ||
    pathname === "/unauthorized" ||
    pathname.startsWith("/auth") ||
    // One-click email unsubscribe must work while logged out (ADR-029): the
    // recipient clicking the link may not be signed in. It's protected by its
    // own HMAC token, not the session.
    pathname === "/api/unsubscribe";

  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    const redirectResponse = NextResponse.redirect(url);
    // Carry the refreshed cookies onto the redirect so the session persists.
    supabaseResponse.cookies.getAll().forEach((cookie) =>
      redirectResponse.cookies.set(cookie),
    );
    return redirectResponse;
  }

  return supabaseResponse;
}
