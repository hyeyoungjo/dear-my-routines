"use client";

import { useState } from "react";
import { createClient } from "@/services/supabase/client";

// Magic-link login stays in the code (ADR-011) but is hidden in the UI for now —
// single-user only. Flip SHOW_MAGIC_LINK to true to re-enable the email form.
const SHOW_MAGIC_LINK = false;

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");
    setErrorMessage("");

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setStatus("error");
      setErrorMessage(error.message);
      return;
    }

    setStatus("sent");
  }

  async function handleGoogleSignIn() {
    setErrorMessage("");

    const supabase = createClient();
    // OAuth redirects back to the shared /auth/callback route (same PKCE
    // `code` exchange as magic links — see ADR-011).
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setStatus("error");
      setErrorMessage(error.message);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold tracking-tight">
          Dear My Routines
        </h1>
        <p className="mt-2 text-sm text-neutral-500">
          Google 계정으로 로그인하세요.
        </p>

        {status === "sent" ? (
          <p className="mt-8 rounded-md bg-neutral-100 p-4 text-sm text-neutral-700">
            메일함을 확인하세요. <strong>{email}</strong> 으로 로그인 링크를
            보냈습니다.
          </p>
        ) : (
          <>
            <button
              type="button"
              onClick={handleGoogleSignIn}
              className="mt-8 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium transition-colors hover:bg-neutral-50"
            >
              Google로 로그인
            </button>

            {status === "error" && (
              <p className="mt-3 text-sm text-red-600">{errorMessage}</p>
            )}

            {SHOW_MAGIC_LINK && (
              <>
                <div className="my-4 flex items-center gap-3 text-xs text-neutral-400">
                  <span className="h-px flex-1 bg-neutral-200" />
                  또는
                  <span className="h-px flex-1 bg-neutral-200" />
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    className="rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900"
                  />
                  <button
                    type="submit"
                    disabled={status === "sending"}
                    className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    {status === "sending" ? "보내는 중…" : "매직링크 보내기"}
                  </button>
                  {status === "error" && (
                    <p className="text-sm text-red-600">{errorMessage}</p>
                  )}
                </form>
              </>
            )}
          </>
        )}
      </div>
    </main>
  );
}
