"use client";

import { useState } from "react";
import { THEMES, useTheme, type Theme } from "@/components/theme";
import { useUndo } from "@/components/undo";
import { AI_MODELS, DEFAULT_MODEL_ID } from "@/services/ai/models";
import { LANGUAGES, DEFAULT_LANGUAGE_ID } from "@/lib/languages";
import { FONTS, DEFAULT_FONT_ID } from "@/lib/fonts";
import { useUserSettings, useUpdateUserSettings } from "@/hooks/userSettings";
import { DEFAULT_GRID_START_HOUR, DEFAULT_GRID_END_HOUR } from "@/core/time/calendar";
import { ExportModal } from "@/components/ExportModal";
import { useTranslations } from "next-intl";

function hourLabel(h: number): string {
  const actual = h % 24;
  const period = actual < 12 ? "AM" : "PM";
  const h12 = actual === 0 ? 12 : actual > 12 ? actual - 12 : actual;
  return h >= 24 ? `${h12}:00 ${period} (+1)` : `${h12}:00 ${period}`;
}

/** Gear button (top-right) that opens settings: theme, AI model, language, undo limit. */
export function ThemeMenu() {
  const t = useTranslations("settings");
  const { theme, setTheme } = useTheme();
  const { max, setMax } = useUndo();
  const [open, setOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const { data: settings } = useUserSettings();
  const updateSettings = useUpdateUserSettings();

  const currentModelId = settings?.aiModel ?? DEFAULT_MODEL_ID;
  const aiEnabled = settings?.aiEnabled ?? false;
  const currentLanguageId = settings?.language ?? DEFAULT_LANGUAGE_ID;
  const currentFontId = settings?.font ?? DEFAULT_FONT_ID;
  const currentGridStart = settings?.gridStartTime ?? DEFAULT_GRID_START_HOUR;
  const currentGridEnd = settings?.gridEndTime ?? DEFAULT_GRID_END_HOUR;

  const LABELS: Record<Theme, string> = {
    light: t("themeLight"),
    dark: t("themeDark"),
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={t("buttonLabel")}
        className="rounded-md p-1 text-2xl leading-none text-muted transition-colors hover:bg-accent-soft hover:text-foreground"
      >
        ⚙
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-1 w-52 rounded-md border border-border bg-panel p-1 shadow-lg">
            {/* Theme */}
            <p className="px-2 py-1 text-xs font-medium text-muted">{t("theme")}</p>
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
              <span>{t("aiAnalysis")}</span>
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
                <p className="px-2 py-1 text-xs font-medium text-muted">{t("aiModel")}</p>
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

            {/* Language */}
            <p className="px-2 py-1 text-xs font-medium text-muted">{t("language")}</p>
            {LANGUAGES.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => {
                  updateSettings.mutate({ language: l.id });
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between rounded px-2 py-1.5 text-sm transition-colors hover:bg-accent-soft ${
                  currentLanguageId === l.id
                    ? "font-medium text-accent"
                    : "text-foreground"
                }`}
              >
                {l.label}
                {currentLanguageId === l.id && <span>&#10003;</span>}
              </button>
            ))}

            <div className="my-1 border-t border-border" />

            {/* Font — each option previewed in its own typeface */}
            <p className="px-2 py-1 text-xs font-medium text-muted">{t("font")}</p>
            {FONTS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => {
                  updateSettings.mutate({ font: f.id });
                  setOpen(false);
                }}
                style={{ fontFamily: `var(${f.variable})` }}
                className={`flex w-full items-center justify-between rounded px-2 py-1.5 text-sm transition-colors hover:bg-accent-soft ${
                  currentFontId === f.id
                    ? "font-medium text-accent"
                    : "text-foreground"
                }`}
              >
                {f.label}
                {currentFontId === f.id && <span>&#10003;</span>}
              </button>
            ))}

            <div className="my-1 border-t border-border" />

            {/* Grid time range */}
            <p className="px-2 py-1 text-xs font-medium text-muted">{t("gridHours")}</p>
            <div className="flex items-center gap-1 px-2 py-1">
              <select
                value={currentGridStart}
                onChange={(e) => updateSettings.mutate({ gridStartTime: Number(e.target.value) })}
                aria-label="Grid start hour"
                className="flex-1 rounded border border-border bg-transparent py-0.5 text-sm text-foreground focus:border-accent focus:outline-none"
              >
                {[4,5,6,7,8,9,10,11].map((h) => (
                  <option key={h} value={h}>{hourLabel(h)}</option>
                ))}
              </select>
              <span className="text-xs text-muted">–</span>
              <select
                value={currentGridEnd}
                onChange={(e) => updateSettings.mutate({ gridEndTime: Number(e.target.value) })}
                aria-label="Grid end hour"
                className="flex-1 rounded border border-border bg-transparent py-0.5 text-sm text-foreground focus:border-accent focus:outline-none"
              >
                {[18,19,20,21,22,23,24,25,26,27,28,29,30].map((h) => (
                  <option key={h} value={h}>{hourLabel(h)}</option>
                ))}
              </select>
            </div>

            <div className="my-1 border-t border-border" />

            {/* Undo/redo history depth (Cmd/Ctrl+Z) — persisted in localStorage. */}
            <label className="flex items-center justify-between gap-2 px-2 py-1.5 text-sm text-foreground">
              <span>{t("undoLimit")}</span>
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
              {t("exportData")}
            </button>
          </div>
        </>
      )}
      <ExportModal open={exportOpen} onClose={() => setExportOpen(false)} />
    </div>
  );
}
