"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { PROJECT_COLORS } from "@/lib/projectColor";
import { useTranslations } from "next-intl";

/** Accepts `#rrggbb` or `rrggbb`. */
const HEX_RE = /^#?[0-9a-fA-F]{6}$/;

/**
 * Custom colour picker drawn from the app's own tokens — a preset palette plus a
 * # hex field — so it matches the rest of the UI (the native `<input type=color>`
 * popup is OS-drawn and unstyleable, like the date popup). Self-contained: the
 * swatch is the trigger.
 *
 * The popover renders in a portal on <body> (fixed), NOT nested under the swatch:
 * its container (the project bar) is `overflow-x-auto`, and CSS makes overflow-y
 * clip too, so an in-place absolute popover is cut off and looks like nothing
 * opens. Portaling + fixed positioning floats it above any ancestor overflow.
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
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  // Place the panel just below the swatch, clamped to the viewport (flip up if it
  // would overflow the bottom, nudge in from the right edge). Runs before paint.
  useLayoutEffect(() => {
    if (!open || !btnRef.current || !panelRef.current) return;
    const btn = btnRef.current.getBoundingClientRect();
    const panel = panelRef.current.getBoundingClientRect();
    const gap = 6;
    const margin = 8;
    let left = btn.left;
    if (left + panel.width > window.innerWidth - margin) {
      left = window.innerWidth - margin - panel.width;
    }
    left = Math.max(margin, left);
    let top = btn.bottom + gap;
    if (top + panel.height > window.innerHeight - margin) {
      top = btn.top - gap - panel.height;
    }
    top = Math.max(margin, top);
    setPos({ left, top });
  }, [open]);

  const commitHex = (raw: string) => {
    if (!HEX_RE.test(raw)) return;
    onChange(`#${raw.replace(/^#/, "")}`.toLowerCase());
    setOpen(false);
  };

  return (
    <span className="relative inline-flex">
      <button
        ref={btnRef}
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
      {open &&
        createPortal(
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <div
              ref={panelRef}
              style={{
                position: "fixed",
                left: pos?.left ?? -9999,
                top: pos?.top ?? -9999,
                visibility: pos ? "visible" : "hidden",
              }}
              className="z-50 w-44 rounded-xl border border-border bg-panel p-2.5 shadow-lg"
            >
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
          </>,
          document.body,
        )}
    </span>
  );
}
