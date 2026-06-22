"use client";

import { createContext, useContext, useMemo, useState } from "react";
import { addDays, dayKey, startOfDay } from "@/core/time/day";

type DateContextValue = {
  /** Local midnight of the day currently in view. */
  selectedDate: Date;
  setSelectedDate: (d: Date) => void;
  goPrevDay: () => void;
  goNextDay: () => void;
  goToday: () => void;
  /** Whether the selected day is today (for disabling the "Today" affordance). */
  isToday: boolean;
};

const DateContext = createContext<DateContextValue | null>(null);

export function useSelectedDate(): DateContextValue {
  const ctx = useContext(DateContext);
  if (!ctx) {
    throw new Error("useSelectedDate must be used within a DateProvider");
  }
  return ctx;
}

/**
 * The selected-day state for the whole app. The calendar (and later the
 * Plan/Act/Review panels) all read this one date, so navigating days reflows
 * them together. The day is the read-model anchor over the normalized rows
 * (ADR-013) — `core/time/day` does the actual scoping.
 *
 * Kept in memory only — no URL, no localStorage — so a fresh load always lands
 * on today (mirrors how ThemeProvider keeps client state lightweight).
 */
export function DateProvider({ children }: { children: React.ReactNode }) {
  const [selectedDate, setSelectedDate] = useState(() => startOfDay(new Date()));

  const value = useMemo<DateContextValue>(
    () => ({
      selectedDate,
      setSelectedDate: (d: Date) => setSelectedDate(startOfDay(d)),
      goPrevDay: () => setSelectedDate((d) => addDays(d, -1)),
      goNextDay: () => setSelectedDate((d) => addDays(d, 1)),
      goToday: () => setSelectedDate(startOfDay(new Date())),
      isToday: dayKey(selectedDate) === dayKey(new Date()),
    }),
    [selectedDate],
  );

  return <DateContext.Provider value={value}>{children}</DateContext.Provider>;
}
