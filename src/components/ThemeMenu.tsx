"use client";

import { useState, useRef } from "react";
import { THEMES, useTheme, type Theme } from "@/components/theme";
import { useUndo } from "@/components/undo";
import { AI_MODELS, DEFAULT_MODEL_ID } from "@/services/ai/models";
import { LANGUAGES, DEFAULT_LANGUAGE_ID } from "@/lib/languages";
import { FONTS, DEFAULT_FONT_ID } from "@/lib/fonts";
import { useUserSettings, useUpdateUserSettings } from "@/hooks/userSettings";
import { DEFAULT_GRID_START_HOUR, DEFAULT_GRID_END_HOUR } from "@/core/time/calendar";
import {
  REVIEW_HISTORY_DAYS_DEFAULT,
  REVIEW_HISTORY_DAYS_MIN,
  REVIEW_HISTORY_DAYS_MAX,
} from "@/core/ai/reviewHistory";
import { ExportModal } from "@/components/ExportModal";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faGear } from "@fortawesome/free-solid-svg-icons";
import { useTranslations } from "next-intl";

function hourLabel(h: number): string {
  const actual = h % 24;
  const period = actual < 12 ? "AM" : "PM";
  const h12 = actual === 0 ? 12 : actual > 12 ? actual - 12 : actual;
  return `${h12} ${period}`;
}

/** A labelled section inside the settings modal. */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted">{title}</p>
      {children}
    </div>
  );
}

/** Gear button (top-right) that opens a centered settings modal. */
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
  const role = settings?.role ?? "user";
  const hasApiKey = settings?.hasApiKey ?? false;
  const [apiKeyInput, setApiKeyInput] = useState("");
  const apiKeyRef = useRef<HTMLInputElement>(null);
  const currentLanguageId = settings?.language ?? DEFAULT_LANGUAGE_ID;
  const currentFontId = settings?.font ?? DEFAULT_FONT_ID;
  const currentGridStart = settings?.gridStartTime ?? DEFAULT_GRID_START_HOUR;
  const currentGridEnd = settings?.gridEndTime ?? DEFAULT_GRID_END_HOUR;
  const currentHistoryDays = settings?.reviewHistoryDays ?? REVIEW_HISTORY_DAYS_DEFAULT;

  // Review style is edited locally and saved on demand (a per-keystroke PUT
  // would be wasteful). null = untouched, so the textarea shows the saved value.
  const [styleInput, setStyleInput] = useState<string | null>(null);
  const styleValue = styleInput ?? settings?.reviewStylePrompt ?? "";

  const LABELS: Record<Theme, string> = {
    light: t("themeLight"),
    dark: t("themeDark"),
  };

  // A selectable row used for theme / model / language / font lists.
  function OptionRow({
    selected,
    onClick,
    children,
    style,
  }: {
    selected: boolean;
    onClick: () => void;
    children: React.ReactNode;
    style?: React.CSSProperties;
  }) {
    return (
      <button
        type="button"
        onClick={onClick}
        style={style}
        className={`flex w-full items-center justify-between rounded px-2 py-1.5 text-sm transition-colors hover:bg-accent-soft ${
          selected ? "font-medium text-accent" : "text-foreground"
        }`}
      >
        {children}
        {selected && <span>&#10003;</span>}
      </button>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("buttonLabel")}
        className="rounded-md p-1 text-xl leading-none text-muted transition-colors hover:bg-accent-soft hover:text-foreground"
      >
        <FontAwesomeIcon icon={faGear} fixedWidth />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30 bg-black/40" onClick={() => setOpen(false)} />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t("title")}
            className="fixed left-1/2 top-1/2 z-40 flex max-h-[85vh] w-[90vw] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col rounded-lg border border-border bg-panel shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2 className="text-base font-medium text-foreground">{t("title")}</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={t("close")}
                className="rounded p-1 text-lg leading-none text-muted transition-colors hover:bg-accent-soft hover:text-foreground"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 overflow-y-auto p-4">
              {/* Theme */}
              <Section title={t("theme")}>
                {THEMES.map((tm) => (
                  <OptionRow key={tm} selected={theme === tm} onClick={() => setTheme(tm)}>
                    {LABELS[tm]}
                  </OptionRow>
                ))}
              </Section>

              {/* AI Analysis toggle */}
              <button
                type="button"
                onClick={() => updateSettings.mutate({ aiEnabled: !aiEnabled })}
                className="flex w-full items-center justify-between rounded px-2 py-1.5 text-sm text-foreground transition-colors hover:bg-accent-soft"
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

              {/* API key — only for regular users (admin/tester use env key) */}
              {role === "user" && (
                <Section title={t("geminiApiKey")}>
                  {hasApiKey ? (
                    <div className="flex items-center justify-between gap-1 px-2">
                      <span className="text-xs text-muted">●●●●●●●●●●●●</span>
                      <button
                        type="button"
                        onClick={() => updateSettings.mutate({ apiKey: null })}
                        className="text-xs text-red-500 hover:underline"
                      >
                        {t("removeKey")}
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-1 px-2">
                      <input
                        ref={apiKeyRef}
                        type="password"
                        value={apiKeyInput}
                        onChange={(e) => setApiKeyInput(e.target.value)}
                        placeholder="AIza..."
                        className="min-w-0 flex-1 rounded border border-border bg-transparent px-1.5 py-0.5 text-xs text-foreground placeholder:text-muted focus:border-accent focus:outline-none"
                      />
                      <button
                        type="button"
                        disabled={!apiKeyInput.trim()}
                        onClick={() => {
                          updateSettings.mutate({ apiKey: apiKeyInput.trim() });
                          setApiKeyInput("");
                        }}
                        className="rounded bg-accent px-2 py-0.5 text-xs text-white disabled:opacity-40"
                      >
                        {t("saveKey")}
                      </button>
                    </div>
                  )}
                </Section>
              )}

              {/* AI-only options */}
              {aiEnabled && (
                <>
                  <Section title={t("aiModel")}>
                    {AI_MODELS.map((m) => (
                      <OptionRow
                        key={m.id}
                        selected={currentModelId === m.id}
                        onClick={() => updateSettings.mutate({ aiModel: m.id })}
                      >
                        {m.label}
                      </OptionRow>
                    ))}
                  </Section>

                  {/* Custom review style guidance */}
                  <Section title={t("reviewStyle")}>
                    <p className="px-2 text-xs text-muted">{t("reviewStyleHint")}</p>
                    <div className="px-2">
                      <textarea
                        value={styleValue}
                        onChange={(e) => setStyleInput(e.target.value)}
                        placeholder={t("reviewStylePlaceholder")}
                        rows={3}
                        maxLength={2000}
                        className="w-full resize-y rounded border border-border bg-transparent px-2 py-1 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none"
                      />
                      <div className="mt-1 flex justify-end">
                        <button
                          type="button"
                          onClick={() =>
                            updateSettings.mutate({
                              reviewStylePrompt: styleValue.trim() || null,
                            })
                          }
                          className="rounded bg-accent px-2 py-0.5 text-xs text-white"
                        >
                          {t("save")}
                        </button>
                      </div>
                    </div>
                  </Section>

                  {/* Review history window */}
                  <Section title={t("reviewHistory")}>
                    <div className="flex items-center justify-between gap-2 px-2">
                      <span className="text-xs text-muted">{t("reviewHistoryHint")}</span>
                      <span className="flex items-center gap-1">
                        <input
                          type="number"
                          min={REVIEW_HISTORY_DAYS_MIN}
                          max={REVIEW_HISTORY_DAYS_MAX}
                          value={currentHistoryDays}
                          onChange={(e) => {
                            const n = Math.round(Number(e.target.value));
                            if (!Number.isFinite(n)) return;
                            const clamped = Math.max(
                              REVIEW_HISTORY_DAYS_MIN,
                              Math.min(REVIEW_HISTORY_DAYS_MAX, n),
                            );
                            updateSettings.mutate({ reviewHistoryDays: clamped });
                          }}
                          aria-label={t("reviewHistory")}
                          className="w-14 rounded border border-border bg-transparent px-1 py-0.5 text-right text-sm text-foreground focus:border-accent focus:outline-none"
                        />
                        <span className="text-xs text-muted">{t("daysUnit")}</span>
                      </span>
                    </div>
                  </Section>
                </>
              )}

              {/* Language */}
              <Section title={t("language")}>
                {LANGUAGES.map((l) => (
                  <OptionRow
                    key={l.id}
                    selected={currentLanguageId === l.id}
                    onClick={() => updateSettings.mutate({ language: l.id })}
                  >
                    {l.label}
                  </OptionRow>
                ))}
              </Section>

              {/* Font — each option previewed in its own typeface */}
              <Section title={t("font")}>
                {FONTS.map((f) => (
                  <OptionRow
                    key={f.id}
                    selected={currentFontId === f.id}
                    onClick={() => updateSettings.mutate({ font: f.id })}
                    style={{ fontFamily: `var(${f.variable})` }}
                  >
                    {f.label}
                  </OptionRow>
                ))}
              </Section>

              {/* Grid time range */}
              <Section title={t("gridHours")}>
                <div className="flex flex-col gap-0.5 px-2">
                  <label className="flex items-center justify-between gap-2 text-sm text-foreground">
                    <span className="text-xs text-muted">From</span>
                    <select
                      value={currentGridStart}
                      onChange={(e) => updateSettings.mutate({ gridStartTime: Number(e.target.value) })}
                      aria-label="Grid start hour"
                      className="rounded border border-border bg-transparent py-0.5 pl-1 text-sm text-foreground focus:border-accent focus:outline-none"
                    >
                      {Array.from({ length: 24 }, (_, i) => i).map((h) => (
                        <option key={h} value={h}>{hourLabel(h)}</option>
                      ))}
                    </select>
                  </label>
                  <label className="flex items-center justify-between gap-2 text-sm text-foreground">
                    <span className="text-xs text-muted">To</span>
                    <select
                      value={currentGridEnd}
                      onChange={(e) => updateSettings.mutate({ gridEndTime: Number(e.target.value) })}
                      aria-label="Grid end hour"
                      className="rounded border border-border bg-transparent py-0.5 pl-1 text-sm text-foreground focus:border-accent focus:outline-none"
                    >
                      {Array.from({ length: 24 }, (_, i) => currentGridStart + 1 + i).map((h) => (
                        <option key={h} value={h}>{hourLabel(h)}</option>
                      ))}
                    </select>
                  </label>
                </div>
              </Section>

              {/* Undo/redo history depth (Cmd/Ctrl+Z) — persisted in localStorage. */}
              <label className="flex items-center justify-between gap-2 px-2 text-sm text-foreground">
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

              <div className="border-t border-border pt-2">
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
            </div>
          </div>
        </>
      )}
      <ExportModal open={exportOpen} onClose={() => setExportOpen(false)} />
    </div>
  );
}
