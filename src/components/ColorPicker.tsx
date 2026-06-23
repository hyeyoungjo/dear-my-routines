"use client";

import { useState } from "react";
import { PROJECT_COLORS } from "@/lib/projectColor";
import { useTranslations } from "@/i18n/context";

/** Accepts `#rrggbb` or `rrggbb`. */
const HEX_RE = /^#?[0-9a-fA-F]{6}$/;

/**
 * Custom colour picker drawn from the app's own tokens — a preset palette plus a
 * # hex field — so it matches the rest of the UI (the native `<input type=color>`
 * popup is OS-drawn and unstyleable, like the date popup). Self-contained: the
 * swatch is the trigger, the popover closes on outside click (ThemeMenu pattern).
 */
export function ColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (hex: string) => void;
}) {
  const t = useTranslations("colorPicker");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");

  const commitHex = (raw: string) => {
    if (!HEX_RE.test(raw)) return;
    onChange(`#${raw.replace(/^#/, "")}`.toLowerCase());
    setOpen(false);
  };

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={() => {
          setDraft(value.replace(/^#/, ""));
          setOpen((o) => !o);
        }}
        aria-label={t("label")}
        title={t("label")}
        className="block size-3.5 rounded-full ring-1 ring-border"
        style={{ backgroundColor: value }}
      />
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-5 z-20 w-44 rounded-xl border border-border bg-panel p-2.5 shadow-lg">
            <div className="grid grid-cols-4 gap-2">
              {PROJECT_COLORS.map((c) => {
                const selected = c.toLowerCase() === value.toLowerCase();
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => {
                      onChange(c);
                      setOpen(false);
                    }}
                    aria-label={c}
                    title={c}
                    className={`size-6 rounded-full transition-transform hover:scale-110 ${
                      selected
                        ? "ring-2 ring-foreground ring-offset-2 ring-offset-panel"
                        : ""
                    }`}
                    style={{ backgroundColor: c }}
                  />
                );
              })}
            </div>

            <div className="mt-2.5 flex items-center gap-1.5 rounded-md border border-border px-2 py-1">
              <span className="text-xs text-muted">#</span>
              <input
                value={draft}
                onChange={(e) =>
                  setDraft(
                    e.target.value.replace(/[^0-9a-fA-F]/g, "").slice(0, 6),
                  )
                }
                onBlur={() => commitHex(draft)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitHex(draft);
                  if (e.key === "Escape") setOpen(false);
                }}
                placeholder="7c5cff"
                aria-label={t("hexLabel")}
                maxLength={6}
                className="w-full bg-transparent text-xs tabular-nums text-foreground placeholder:text-muted focus:outline-none"
              />
              <span
                className="size-3.5 shrink-0 rounded-full border border-border"
                style={{
                  backgroundColor: HEX_RE.test(draft) ? `#${draft}` : "transparent",
                }}
              />
            </div>
          </div>
        </>
      )}
    </span>
  );
}
