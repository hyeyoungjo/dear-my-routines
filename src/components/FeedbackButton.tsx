"use client";

import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faComment, faXmark } from "@fortawesome/free-solid-svg-icons";
import { useTranslations } from "next-intl";

export function FeedbackButton({
  userEmail,
  variant = "icon",
}: {
  userEmail: string;
  variant?: "icon" | "menu";
}) {
  const t = useTranslations("feedback");
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function submit() {
    if (!message.trim()) return;
    setStatus("sending");
    const res = await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
    if (res.ok) {
      setStatus("sent");
      setTimeout(() => {
        setOpen(false);
        setMessage("");
        setStatus("idle");
      }, 1500);
    } else {
      setStatus("error");
    }
  }

  function close() {
    setOpen(false);
    setMessage("");
    setStatus("idle");
  }

  return (
    <div className="relative">
      {variant === "menu" ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-accent-soft"
        >
          <FontAwesomeIcon icon={faComment} fixedWidth />
          {t("title")}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={t("title")}
          title={t("title")}
          className="rounded-md p-1 text-xl leading-none text-muted transition-colors hover:bg-accent-soft hover:text-foreground"
        >
          <FontAwesomeIcon icon={faComment} fixedWidth />
        </button>
      )}

      {open && (
        <>
          <div className="fixed inset-0 z-30 bg-black/40" onClick={close} />
          <div
            role="dialog"
            aria-label="Send feedback"
            className="fixed left-1/2 top-1/2 z-40 w-80 max-w-[92vw] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-panel p-4 shadow-xl"
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-medium text-foreground">{t("title")}</h2>
              <button
                type="button"
                onClick={close}
                aria-label="Close"
                className="rounded p-1 text-base leading-none text-muted transition-colors hover:bg-accent-soft hover:text-foreground"
              >
                <FontAwesomeIcon icon={faXmark} />
              </button>
            </div>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t("placeholder")}
              rows={4}
              className="w-full resize-none rounded border border-border bg-transparent px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none"
            />
            <div className="mt-3 flex items-center justify-end gap-2">
              {status === "sent" && (
                <span className="text-xs text-muted">{t("sent")}</span>
              )}
              {status === "error" && (
                <span className="text-xs text-red-400">{t("error")}</span>
              )}
              <button
                type="button"
                onClick={submit}
                disabled={status === "sending" || status === "sent" || !message.trim()}
                className="rounded-md bg-accent px-3 py-1.5 text-xs text-white transition-opacity disabled:opacity-50"
              >
                {status === "sending" ? t("sending") : t("send")}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
