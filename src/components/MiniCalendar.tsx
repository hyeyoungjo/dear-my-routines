"use client";

import { useState } from "react";
import { dayKey, isSameMonth, monthGrid } from "@/core/time/day";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTH_LABEL: Intl.DateTimeFormatOptions = { month: "long", year: "numeric" };

/**
 * Month-grid date picker drawn entirely from the app's own tokens (rounded,
 * panel surface, accent point) so it matches the rest of the UI — unlike the
 * native date popup, which the OS draws and we can't style. The grid geometry
 * comes from the pure `core/time/day` `monthGrid` (Sunday-first, 6 rows).
 */
export function MiniCalendar({
  selected,
  onSelect,
}: {
  selected: Date;
  onSelect: (date: Date) => void;
}) {
  // The month in view starts on the selected day's month; ‹ › steps it.
  const [viewMonth, setViewMonth] = useState(selected);
  const weeks = monthGrid(viewMonth);
  const selectedKey = dayKey(selected);
  const todayKey = dayKey(new Date());

  const stepMonth = (delta: number) =>
    setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1));

  const nav =
    "rounded-md px-2 py-1 text-base leading-none text-muted transition-colors hover:bg-accent-soft hover:text-foreground";

  return (
    <div className="w-64 select-none">
      <div className="mb-2 flex items-center justify-between">
        <button type="button" onClick={() => stepMonth(-1)} aria-label="Previous month" className={nav}>
          ‹
        </button>
        <span className="text-sm font-medium text-foreground">
          {viewMonth.toLocaleDateString("en-US", MONTH_LABEL)}
        </span>
        <button type="button" onClick={() => stepMonth(1)} aria-label="Next month" className={nav}>
          ›
        </button>
      </div>

      <div className="grid grid-cols-7 gap-0.5">
        {WEEKDAYS.map((w) => (
          <div key={w} className="py-1 text-center text-[10px] font-medium text-muted">
            {w}
          </div>
        ))}
        {weeks.flat().map((day) => {
          const key = dayKey(day);
          const inMonth = isSameMonth(day, viewMonth);
          const isSelected = key === selectedKey;
          const isToday = key === todayKey;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelect(day)}
              className={`h-8 rounded-md text-xs tabular-nums transition-colors ${
                isSelected
                  ? "bg-accent font-semibold text-white"
                  : `hover:bg-accent-soft ${inMonth ? "text-foreground" : "text-muted opacity-50"}`
              } ${isToday && !isSelected ? "ring-1 ring-accent/50" : ""}`}
            >
              {day.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}
