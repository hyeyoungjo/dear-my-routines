"use client";

import { useState } from "react";
import { AI_MODELS, DEFAULT_MODEL_ID } from "@/services/ai/models";
import { useUserSettings, useUpdateUserSettings } from "@/hooks/userSettings";

/** AI model selector — gear icon next to ThemeMenu in the header. */
export function SettingsMenu() {
  const [open, setOpen] = useState(false);
  const { data: settings } = useUserSettings();
  const update = useUpdateUserSettings();

  const currentModelId = settings?.aiModel ?? DEFAULT_MODEL_ID;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="AI model settings"
        className="rounded-md px-2 py-1 text-xs font-medium text-muted transition-colors hover:bg-accent-soft hover:text-foreground"
      >
        AI
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-1 w-52 rounded-md border border-border bg-panel p-1 shadow-lg">
            <p className="px-2 py-1 text-xs font-medium text-muted">
              AI Model
            </p>
            {AI_MODELS.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  update.mutate({ aiModel: m.id });
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between rounded px-2 py-1.5 text-sm transition-colors hover:bg-accent-soft ${
                  currentModelId === m.id
                    ? "font-medium text-accent"
                    : "text-foreground"
                }`}
              >
                {m.label}
                {currentModelId === m.id && <span>&#10003;</span>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
