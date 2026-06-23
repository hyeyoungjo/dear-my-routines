"use client";

import { useState } from "react";
import { THEMES, useTheme, type Theme } from "@/components/theme";
import { useUndo } from "@/components/undo";
import { AI_MODELS, DEFAULT_MODEL_ID } from "@/services/ai/models";
import { useUserSettings, useUpdateUserSettings } from "@/hooks/userSettings";
import { ExportModal } from "@/components/ExportModal";

const LABELS: Record<Theme, string> = {
  light: "Light",
  dark: "Dark",
};

/** Gear button (top-right) that opens settings: theme, AI model, undo limit. */
export function ThemeMenu() {
  const { theme, setTheme } = useTheme();
  const { max, setMax } = useUndo();
  const [open, setOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const { data: settings } = useUserSettings();
  const updateSettings = useUpdateUserSettings();

  const currentModelId = settings?.aiModel ?? DEFAULT_MODEL_ID;
  const aiEnabled = settings?.aiEnabled ?? false;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Settings"
        className="rounded-md p-1 text-2xl leading-none text-muted transition-colors hover:bg-accent-soft hover:text-foreground"
      >
        ⚙
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-1 w-52 rounded-md border border-border bg-panel p-1 shadow-lg">
            {/* Theme */}
            <p className="px-2 py-1 text-xs font-medium text-muted">Theme</p>
            {THEMES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  setTheme(t);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between rounded px-2 py-1.5 text-sm transition-colors hover:bg-accent-soft ${
                  theme === t ? "font-medium text-accent" : "text-foreground"
                }`}
              >
                {LABELS[t]}
                {theme === t && <span>&#10003;</span>}
              </button>
            ))}

            <div className="my-1 border-t border-border" />

            {/* AI Analysis toggle */}
            <button
              type="button"
              onClick={() => updateSettings.mutate({ aiEnabled: !aiEnabled })}
              className="flex w-full items-center justify-between rounded px-2 py-1.5 text-sm text-foreground hover:bg-accent-soft transition-colors"
            >
              <span>AI Analysis</span>
              <span
                className={`inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                  aiEnabled ? "bg-accent" : "bg-border"
                }`}
              >
                <span
                  className={`h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
                    aiEnabled ? "translate-x-4" : "translate-x-1"
                  }`}
                />
              </span>
            </button>

            {/* AI Model — only when AI is enabled */}
            {aiEnabled && (
              <>
                <p className="px-2 py-1 text-xs font-medium text-muted">AI Model</p>
                {AI_MODELS.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  updateSettings.mutate({ aiModel: m.id });
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
              </>
            )}

            <div className="my-1 border-t border-border" />

            {/* Undo/redo history depth (Cmd/Ctrl+Z) — persisted in localStorage. */}
            <label className="flex items-center justify-between gap-2 px-2 py-1.5 text-sm text-foreground">
              <span>Undo limit</span>
              <input
                type="number"
                min={1}
                max={50}
                value={max}
                onChange={(e) => setMax(Number(e.target.value))}
                aria-label="Undo history limit"
                className="w-12 rounded border border-border bg-transparent px-1 py-0.5 text-right text-foreground focus:border-accent focus:outline-none"
              />
            </label>

            <div className="my-1 border-t border-border" />

            <button
              type="button"
              onClick={() => {
                setExportOpen(true);
                setOpen(false);
              }}
              className="flex w-full items-center rounded px-2 py-1.5 text-sm text-foreground transition-colors hover:bg-accent-soft"
            >
              Export data
            </button>
          </div>
        </>
      )}
      <ExportModal open={exportOpen} onClose={() => setExportOpen(false)} />
    </div>
  );
}
