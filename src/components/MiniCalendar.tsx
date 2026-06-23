"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { dayKey, isSameMonth, monthGrid } from "@/core/time/day";

const MONTH_LABEL: Intl.DateTimeFormatOptions = { month: "long", year: "numeric" };

/**
 * Weekday headers in the active locale, Sunday-first to match `monthGrid`.
 * 2023-01-01 is a Sunday, so it anchors the 7-day sequence; `Intl` localizes
 * each label ("Sun"/"일") instead of hardcoding English.
 */
function weekdayLabels(locale: string): string[] {
  const fmt = new Intl.DateTimeFormat(locale, { weekday: "short" });
  return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(2023, 0, 1 + i)));
}

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
  const locale = useLocale();
  const t = useTranslations("calendar");
  const weekdays = useMemo(() => weekdayLabels(locale), [locale]);
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
        <button type="button" onClick={() => stepMonth(-1)} aria-label={t("prevMonth")} className={nav}>
          ‹
        </button>
        <span className="text-sm font-medium text-foreground">
          {viewMonth.toLocaleDateString(locale, MONTH_LABEL)}
        </span>
        <button type="button" onClick={() => stepMonth(1)} aria-label={t("nextMonth")} className={nav}>
          ›
        </button>
      </div>

      <div className="grid grid-cols-7 gap-0.5">
        {weekdays.map((w) => (
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
