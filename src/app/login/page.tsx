"use client";

import { Fragment, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faGoogle } from "@fortawesome/free-brands-svg-icons";
import { createClient } from "@/services/supabase/client";
import { useTranslations, useLocale } from "next-intl";
import { LANGUAGES } from "@/lib/languages";
import { GUEST_LOCALE_EVENT } from "@/i18n/provider";

// Magic-link login stays in the code (ADR-011) but is hidden in the UI for now —
// single-user only. Flip SHOW_MAGIC_LINK to true to re-enable the email form.
const SHOW_MAGIC_LINK = false;

// Toggles the "Continue with Google" button (rendered below the email form).
// The OAuth code stays regardless, so this is purely a UI switch.
const SHOW_GOOGLE = true;

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // Password form toggles between signing in and creating an account.
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const t = useTranslations("login");
  const [status, setStatus] = useState<
    "idle" | "sending" | "sent" | "confirm" | "reset" | "error"
  >("idle");
  const [errorMessage, setErrorMessage] = useState("");

  async function handleForgotPassword() {
    setErrorMessage("");
    if (!email) {
      setStatus("error");
      setErrorMessage(t("enterEmailFirst"));
      return;
    }

    setStatus("sending");
    const supabase = createClient();
    // The recovery link lands on /auth/callback, which exchanges the code and
    // forwards to /auth/update-password where the new password is set.
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/auth/update-password`,
    });

    if (error) {
      setStatus("error");
      setErrorMessage(error.message);
      return;
    }

    setStatus("reset");
  }

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

  const locale = useLocale();

  function switchLocale(id: string) {
    localStorage.setItem("dmr-locale", id);
    window.dispatchEvent(new Event(GUEST_LOCALE_EVENT));
  }

  return (
    <main className="relative flex min-h-screen flex-col md:flex-row">
      {/* Language toggle — top-right corner */}
      <div className="absolute right-4 top-4 z-10 flex items-center gap-1 rounded-full border border-neutral-200 bg-white/80 px-1 py-0.5 text-xs backdrop-blur-sm">
        {LANGUAGES.map((l, i) => (
          <Fragment key={l.id}>
            {i > 0 && <span className="text-neutral-300">/</span>}
            <button
              type="button"
              onClick={() => switchLocale(l.id)}
              className={`rounded-full px-2 py-0.5 transition-colors ${
                locale === l.id
                  ? "bg-neutral-900 text-white"
                  : "text-neutral-500 hover:text-neutral-900"
              }`}
            >
              {l.label}
            </button>
          </Fragment>
        ))}
      </div>
      {/* Left: app preview */}
      <div className="flex flex-col justify-center gap-6 border-b border-neutral-200 bg-neutral-50 px-8 py-12 md:w-[55%] md:border-b-0 md:border-r md:px-12 md:py-16">
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-neutral-400">
            Dear My Routines
          </p>
          <h1 className="text-xl font-semibold leading-snug tracking-tight text-neutral-900">
            {t("headline")}
          </h1>
        </div>

        {/* How it works */}
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-neutral-400">
            {t("howToUse")}
          </p>
          <ol className="flex flex-col gap-2">
            {(
              [
                { label: t("step1Label"), desc: t("step1Desc") },
                { label: t("step2Label"), desc: t("step2Desc") },
                { label: t("step3Label"), desc: t("step3Desc") },
              ] as { label: string; desc: string }[]
            ).map((step, i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-neutral-600">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-[10px] font-bold text-white">
                  {i + 1}
                </span>
                <span>
                  <span className="font-semibold text-neutral-900">{step.label}</span>
                  {" — "}
                  {step.desc}
                </span>
              </li>
            ))}
          </ol>
        </div>

        <div className="overflow-hidden rounded-xl border border-neutral-200 shadow-md">
          <img
            src="/screenshots/main-light.png"
            alt="Dear My Routines — Plan, Act, Reflect"
            className="w-full"
          />
        </div>
      </div>

      {/* Right: sign-in form */}
      <div className="flex flex-1 flex-col items-center justify-center px-8 py-12">
      <div className="w-full max-w-sm">
        <h2 className="text-2xl font-semibold tracking-tight">
          {mode === "signup" ? t("createAccount") : t("signIn")}
        </h2>

        {status === "sent" ? (
          <p className="mt-8 rounded-md bg-neutral-100 p-4 text-sm text-neutral-700">
            {t("checkInbox", { email })}
          </p>
        ) : status === "confirm" ? (
          <p className="mt-8 rounded-md bg-neutral-100 p-4 text-sm text-neutral-700">
            {t("confirmEmailSent", { email })}
          </p>
        ) : status === "reset" ? (
          <p className="mt-8 rounded-md bg-neutral-100 p-4 text-sm text-neutral-700">
            {t("resetEmailSent", { email })}
          </p>
        ) : (
          <>
            <form
              onSubmit={handlePasswordSubmit}
              className="mt-8 flex flex-col gap-3"
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

              {mode === "signin" && (
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="self-end text-xs text-neutral-500 underline-offset-2 hover:text-neutral-900 hover:underline"
                >
                  {t("forgotPassword")}
                </button>
              )}
            </form>

            {status === "error" && (
              <p className="mt-3 text-sm text-red-600">{errorMessage}</p>
            )}

            {SHOW_GOOGLE && (
              <>
                <div className="my-5 flex items-center gap-3 text-xs text-neutral-400">
                  <span className="h-px flex-1 bg-neutral-200" />
                  {t("or")}
                  <span className="h-px flex-1 bg-neutral-200" />
                </div>

                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  className="flex w-full items-center justify-center gap-2 rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium transition-colors hover:bg-neutral-50"
                >
                  <FontAwesomeIcon icon={faGoogle} />
                  {t("continueWithGoogle")}
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() => {
                setMode((m) => (m === "signin" ? "signup" : "signin"));
                setStatus("idle");
                setErrorMessage("");
              }}
              className="group mt-5 w-full text-center text-sm text-neutral-500"
            >
              {mode === "signin"
                ? t("toggleToSignUpPrompt")
                : t("toggleToSignInPrompt")}{" "}
              <span className="font-semibold text-neutral-900 underline underline-offset-2 group-hover:opacity-80">
                {mode === "signin" ? t("createAccount") : t("signIn")}
              </span>
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
      </div>
    </main>
  );
}
