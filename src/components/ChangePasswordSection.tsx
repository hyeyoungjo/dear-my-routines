"use client";

import { useState } from "react";
import { createClient } from "@/services/supabase/client";
import { useTranslations } from "next-intl";

/**
 * In-app password change for the logged-in user. Calls updateUser({ password })
 * directly, so it needs no recovery email — handy for accounts created via
 * Google OAuth that want a reusable email + password login.
 */
export function ChangePasswordSection() {
  const t = useTranslations("updatePassword");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSave() {
    setErrorMessage("");

    if (password.length < 8) {
      setStatus("error");
      setErrorMessage(t("tooShort"));
      return;
    }
    if (password !== confirm) {
      setStatus("error");
      setErrorMessage(t("mismatch"));
      return;
    }

    setStatus("saving");
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setStatus("error");
      setErrorMessage(error.message);
      return;
    }

    setPassword("");
    setConfirm("");
    setStatus("saved");
  }

  return (
    <div className="flex flex-col gap-1 px-2">
      <input
        type="password"
        value={password}
        minLength={8}
        onChange={(e) => {
          setPassword(e.target.value);
          if (status !== "idle") setStatus("idle");
        }}
        placeholder={t("newPassword")}
        autoComplete="new-password"
        className="rounded border border-border bg-transparent px-1.5 py-0.5 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none"
      />
      <input
        type="password"
        value={confirm}
        minLength={8}
        onChange={(e) => {
          setConfirm(e.target.value);
          if (status !== "idle") setStatus("idle");
        }}
        placeholder={t("confirmPassword")}
        autoComplete="new-password"
        className="rounded border border-border bg-transparent px-1.5 py-0.5 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none"
      />
      <div className="mt-1 flex items-center justify-between gap-2">
        <span className="text-xs">
          {status === "saved" && (
            <span className="text-accent">{t("saved")}</span>
          )}
          {status === "error" && (
            <span className="text-red-500">{errorMessage}</span>
          )}
        </span>
        <button
          type="button"
          disabled={status === "saving" || !password || !confirm}
          onClick={handleSave}
          className="rounded bg-accent px-2 py-0.5 text-xs text-white disabled:opacity-40"
        >
          {status === "saving" ? t("saving") : t("submit")}
        </button>
      </div>
    </div>
  );
}
