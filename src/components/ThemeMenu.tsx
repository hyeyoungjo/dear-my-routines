"use client";

import { useState } from "react";
import { THEMES, useTheme, type Theme } from "@/components/theme";
import { useUndo } from "@/components/undo";

const LABELS: Record<Theme, string> = {
  light: "Light",
  dark: "Dark",
};

/** Gear button (top-right) that opens a small theme picker. */
export function ThemeMenu() {
  const { theme, setTheme } = useTheme();
  const { max, setMax } = useUndo();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Theme settings"
        className="rounded-md p-1 text-2xl leading-none text-muted transition-colors hover:bg-accent-soft hover:text-foreground"
      >
        ⚙
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-1 w-44 rounded-md border border-border bg-panel p-1 shadow-lg">
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
                {theme === t && <span>✓</span>}
              </button>
            ))}

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
          </div>
        </>
      )}
    </div>
  );
}
