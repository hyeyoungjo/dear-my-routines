"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ShelfColumn } from "@/components/calendar/ShelfColumn";

/**
 * Left-rail (Shelf) open/close state, shared between the header toggle button and
 * the body's left rail — they're siblings in the layout, so a tiny context is the
 * cleanest way to link them without lifting the whole page into one client tree.
 *
 * One button, every size: on desktop the rail is an inline column; on mobile it
 * opens as an overlay drawer. It starts open on desktop but auto-closes on mobile
 * at mount (so the drawer never covers the screen on load), and the drawer only
 * renders after mount to avoid a hydration flash.
 */
const SidebarContext = createContext<{
  leftOpen: boolean;
  toggleLeft: () => void;
  mounted: boolean;
} | null>(null);

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [leftOpen, setLeftOpen] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Start collapsed on mobile so the overlay drawer doesn't cover the screen.
    if (window.matchMedia("(max-width: 639px)").matches) setLeftOpen(false);
  }, []);

  return (
    <SidebarContext.Provider
      value={{ leftOpen, mounted, toggleLeft: () => setLeftOpen((o) => !o) }}
    >
      {children}
    </SidebarContext.Provider>
  );
}

function useSidebar() {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error("useSidebar must be used within SidebarProvider");
  return ctx;
}

/** The sidebar glyph: a rounded frame with the left panel filled in. */
function SidebarIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect
        x="1.75"
        y="2.75"
        width="12.5"
        height="10.5"
        rx="2.25"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <rect x="2.6" y="3.6" width="3.4" height="8.8" rx="1.2" fill="currentColor" />
    </svg>
  );
}

/** Header button that toggles the Shelf — inline rail on desktop, drawer on mobile.
 *  `variant="menu"` renders it as an icon+label row for the mobile hamburger. */
export function LeftPanelToggle({
  variant = "icon",
}: {
  variant?: "icon" | "menu";
}) {
  const { leftOpen, toggleLeft } = useSidebar();
  const t = useTranslations("shelf");
  if (variant === "menu") {
    return (
      <button
        type="button"
        onClick={toggleLeft}
        aria-pressed={leftOpen}
        className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-accent-soft"
      >
        <span className="inline-flex w-5 justify-center">
          <SidebarIcon />
        </span>
        {t("toggle")}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={toggleLeft}
      aria-label={t("toggle")}
      aria-pressed={leftOpen}
      title={t("toggle")}
      className={`inline-flex size-8 shrink-0 items-center justify-center rounded-md transition-colors ${
        leftOpen
          ? "text-foreground hover:bg-accent-soft"
          : "text-muted hover:bg-accent-soft hover:text-foreground"
      }`}
    >
      <SidebarIcon />
    </button>
  );
}

/**
 * The Shelf rail: an inline column on desktop (`sm+`) and an overlay drawer on
 * mobile. Both hold the same self-contained `ShelfColumn`.
 */
export function LeftRail() {
  const { leftOpen, mounted, toggleLeft } = useSidebar();
  return (
    <>
      {/* Desktop: inline rail beside the calendar. */}
      {leftOpen && (
        <aside className="hidden w-52 shrink-0 sm:block">
          <div className="rounded-xl border border-border bg-panel p-4">
            <ShelfColumn />
          </div>
        </aside>
      )}

      {/* Mobile: slide-over drawer with a backdrop (mounted-gated, no flash). */}
      {mounted && leftOpen && (
        <div className="fixed inset-0 z-40 sm:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={toggleLeft}
            role="presentation"
          />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[82%] overflow-y-auto border-r border-border bg-panel p-4 shadow-xl">
            <ShelfColumn />
          </aside>
        </div>
      )}
    </>
  );
}
