"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ShelfColumn } from "@/components/calendar/ShelfColumn";
import { AiPanel } from "@/components/calendar/AiPanel";

/**
 * Open/close state for the two side rails — the Shelf (left) and the AI panel
 * (right) — shared between the header toggle buttons and the body rails. They're
 * siblings in the layout, so a tiny context is the cleanest way to link them
 * without lifting the whole page into one client tree.
 *
 * One button per side, every size: on desktop each rail is an inline column; on
 * mobile it opens as an overlay drawer. Both start open on desktop but auto-close
 * on mobile at mount (so a drawer never covers the screen on load), and drawers
 * only render after mount to avoid a hydration flash.
 */
const SidebarContext = createContext<{
  leftOpen: boolean;
  rightOpen: boolean;
  toggleLeft: () => void;
  toggleRight: () => void;
  mounted: boolean;
} | null>(null);

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Start collapsed on mobile so an overlay drawer doesn't cover the screen.
    if (window.matchMedia("(max-width: 639px)").matches) {
      setLeftOpen(false);
      setRightOpen(false);
    }
  }, []);

  return (
    <SidebarContext.Provider
      value={{
        leftOpen,
        rightOpen,
        mounted,
        toggleLeft: () => setLeftOpen((o) => !o),
        toggleRight: () => setRightOpen((o) => !o),
      }}
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

/** A sidebar glyph: a rounded frame with one side panel filled (left or right). */
function SidebarIcon({ side }: { side: "left" | "right" }) {
  return (
    <svg width="17" height="17" viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect x="1.75" y="2.75" width="12.5" height="10.5" rx="2.25" stroke="currentColor" strokeWidth="1.4" />
      <rect x={side === "left" ? 2.6 : 10} y="3.6" width="3.4" height="8.8" rx="1.2" fill="currentColor" />
    </svg>
  );
}

/** A header toggle button for one rail. `variant="menu"` is the hamburger row. */
function PanelToggle({
  side,
  open,
  toggle,
  label,
  variant,
}: {
  side: "left" | "right";
  open: boolean;
  toggle: () => void;
  label: string;
  variant: "icon" | "menu";
}) {
  if (variant === "menu") {
    return (
      <button
        type="button"
        onClick={toggle}
        aria-pressed={open}
        className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-accent-soft"
      >
        <span className="inline-flex w-5 justify-center">
          <SidebarIcon side={side} />
        </span>
        {label}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      aria-pressed={open}
      title={label}
      className={`inline-flex size-8 shrink-0 items-center justify-center rounded-md transition-colors ${
        open
          ? "text-foreground hover:bg-accent-soft"
          : "text-muted hover:bg-accent-soft hover:text-foreground"
      }`}
    >
      <SidebarIcon side={side} />
    </button>
  );
}

/** Toggles the Shelf (left) rail. */
export function LeftPanelToggle({ variant = "icon" }: { variant?: "icon" | "menu" }) {
  const { leftOpen, toggleLeft } = useSidebar();
  const t = useTranslations("shelf");
  return <PanelToggle side="left" open={leftOpen} toggle={toggleLeft} label={t("toggle")} variant={variant} />;
}

/** Toggles the AI (right) panel. */
export function RightPanelToggle({ variant = "icon" }: { variant?: "icon" | "menu" }) {
  const { rightOpen, toggleRight } = useSidebar();
  const t = useTranslations("review");
  return <PanelToggle side="right" open={rightOpen} toggle={toggleRight} label={t("aiToggle")} variant={variant} />;
}

/** The Shelf rail: inline column on desktop, overlay drawer (from the left) on mobile. */
export function LeftRail() {
  const { leftOpen, mounted, toggleLeft } = useSidebar();
  return (
    <>
      {leftOpen && (
        <aside className="hidden w-52 shrink-0 sm:block">
          <div className="rounded-xl border border-border bg-panel p-4">
            <ShelfColumn />
          </div>
        </aside>
      )}
      {mounted && leftOpen && (
        <div className="fixed inset-0 z-40 sm:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={toggleLeft} role="presentation" />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[82%] overflow-y-auto border-r border-border bg-panel p-4 shadow-xl">
            <ShelfColumn />
          </aside>
        </div>
      )}
    </>
  );
}

/** The AI rail: inline column on desktop, overlay drawer (from the right) on mobile. */
export function RightRail() {
  const { rightOpen, mounted, toggleRight } = useSidebar();
  return (
    <>
      {rightOpen && (
        <aside className="hidden w-52 shrink-0 sm:block">
          <div className="rounded-xl border border-border bg-panel p-4">
            <AiPanel />
          </div>
        </aside>
      )}
      {mounted && rightOpen && (
        <div className="fixed inset-0 z-40 sm:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={toggleRight} role="presentation" />
          <aside className="absolute inset-y-0 right-0 w-72 max-w-[82%] overflow-y-auto border-l border-border bg-panel p-4 shadow-xl">
            <AiPanel />
          </aside>
        </div>
      )}
    </>
  );
}
