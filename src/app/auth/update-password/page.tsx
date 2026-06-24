"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/services/supabase/client";
import { useTranslations } from "next-intl";

/**
 * Lands here after a password-recovery link is exchanged in /auth/callback
 * (which sets a recovery session). The user picks a new password — from then
 * on they can sign in with email + password, even if the account was created
 * via Google OAuth (no password until now).
 */
export default function UpdatePasswordPage() {
  const t = useTranslations("updatePassword");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<
    "checking" | "ready" | "saving" | "saved" | "error" | "no-session"
  >("checking");
  const [errorMessage, setErrorMessage] = useState("");

  // The recovery link must have produced a session by the time we get here.
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      setStatus(data.session ? "ready" : "no-session");
    });
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");

    if (password.length < 8) {
      setErrorMessage(t("tooShort"));
      return;
    }
    if (password !== confirm) {
      setErrorMessage(t("mismatch"));
      return;
    }

    setStatus("saving");
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setStatus("ready");
      setErrorMessage(error.message);
      return;
    }

    setStatus("saved");
    // Full navigation so the server middleware re-reads the session cookie.
    window.location.href = "/";
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-8 py-12">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-2 text-sm text-neutral-500">{t("subtitle")}</p>

        {status === "no-session" ? (
          <p className="mt-8 rounded-md bg-neutral-100 p-4 text-sm text-neutral-700">
            {t("invalidSession")}
          </p>
        ) : status === "saved" ? (
          <p className="mt-8 rounded-md bg-neutral-100 p-4 text-sm text-neutral-700">
            {t("success")}
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-3">
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={t("newPassword")}
              autoComplete="new-password"
              disabled={status === "checking"}
              className="rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900"
            />
            <input
              type="password"
              required
              minLength={8}
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              placeholder={t("confirmPassword")}
              autoComplete="new-password"
              disabled={status === "checking"}
              className="rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900"
            />
            <button
              type="submit"
              disabled={status === "saving" || status === "checking"}
              className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {status === "saving" ? t("saving") : t("submit")}
            </button>
            {errorMessage && (
              <p className="text-sm text-red-600">{errorMessage}</p>
            )}
          </form>
        )}
      </div>
    </main>
  );
}
