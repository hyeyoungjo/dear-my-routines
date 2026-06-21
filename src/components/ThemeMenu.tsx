"use client";

import { useState } from "react";
import { THEMES, useTheme, type Theme } from "@/components/theme";

const LABELS: Record<Theme, string> = {
  light: "Light",
  dark: "Dark",
};

/** Gear button (top-right) that opens a small theme picker. */
export function ThemeMenu() {
  const { theme, setTheme } = useTheme();
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
          <div className="absolute right-0 z-20 mt-1 w-36 rounded-md border border-border bg-panel p-1 shadow-lg">
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
          </div>
        </>
      )}
    </div>
  );
}
