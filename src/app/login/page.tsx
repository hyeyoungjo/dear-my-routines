"use client";

import { useState } from "react";
import { createClient } from "@/services/supabase/client";
import { useTranslations } from "next-intl";

// Magic-link login stays in the code (ADR-011) but is hidden in the UI for now —
// single-user only. Flip SHOW_MAGIC_LINK to true to re-enable the email form.
const SHOW_MAGIC_LINK = false;

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // Password form toggles between signing in and creating an account.
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const t = useTranslations("login");
  const [status, setStatus] = useState<
    "idle" | "sending" | "sent" | "confirm" | "error"
  >("idle");
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

  async function handlePasswordSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");
    setErrorMessage("");

    const supabase = createClient();

    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        setStatus("error");
        setErrorMessage(error.message);
        return;
      }

      // When email confirmation is required, sign-up returns no session —
      // ask the user to confirm via the link first.
      if (!data.session) {
        setStatus("confirm");
        return;
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setStatus("error");
        setErrorMessage(error.message);
        return;
      }
    }

    // Full navigation so the server middleware re-reads the new session cookie.
    window.location.href = "/";
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

        {status === "sent" ? (
          <p className="mt-8 rounded-md bg-neutral-100 p-4 text-sm text-neutral-700">
            {t("checkInbox", { email })}
          </p>
        ) : status === "confirm" ? (
          <p className="mt-8 rounded-md bg-neutral-100 p-4 text-sm text-neutral-700">
            {t("confirmEmailSent", { email })}
          </p>
        ) : (
          <>
            <button
              type="button"
              onClick={handleGoogleSignIn}
              className="mt-8 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium transition-colors hover:bg-neutral-50"
            >
              {t("continueWithGoogle")}
            </button>

            <div className="my-4 flex items-center gap-3 text-xs text-neutral-400">
              <span className="h-px flex-1 bg-neutral-200" />
              {t("or")}
              <span className="h-px flex-1 bg-neutral-200" />
            </div>

            <form
              onSubmit={handlePasswordSubmit}
              className="flex flex-col gap-3"
            >
              <input
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder={t("emailPlaceholder")}
                autoComplete="email"
                className="rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900"
              />
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={t("passwordPlaceholder")}
                autoComplete={
                  mode === "signup" ? "new-password" : "current-password"
                }
                className="rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900"
              />
              <button
                type="submit"
                disabled={status === "sending"}
                className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {status === "sending"
                  ? t("sending")
                  : mode === "signup"
                    ? t("createAccount")
                    : t("signIn")}
              </button>
            </form>

            {status === "error" && (
              <p className="mt-3 text-sm text-red-600">{errorMessage}</p>
            )}

            <button
              type="button"
              onClick={() => {
                setMode((m) => (m === "signin" ? "signup" : "signin"));
                setStatus("idle");
                setErrorMessage("");
              }}
              className="mt-4 w-full text-center text-xs text-neutral-500 underline-offset-2 hover:underline"
            >
              {mode === "signin" ? t("toggleToSignUp") : t("toggleToSignIn")}
            </button>

            {SHOW_MAGIC_LINK && (
              <>
                <div className="my-4 flex items-center gap-3 text-xs text-neutral-400">
                  <span className="h-px flex-1 bg-neutral-200" />
                  {t("or")}
                  <span className="h-px flex-1 bg-neutral-200" />
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder={t("emailPlaceholder")}
                    autoComplete="email"
                    className="rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900"
                  />
                  <button
                    type="submit"
                    disabled={status === "sending"}
                    className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    {status === "sending" ? t("sending") : t("sendMagicLink")}
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
