"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useSelectedDate } from "@/components/date";
import { MiniCalendar } from "@/components/MiniCalendar";

/** "Sat Jun 21" — compact, weekday-anchored so the day-of-week reads at a glance. */
const DATE_LABEL: Intl.DateTimeFormatOptions = {
  weekday: "short",
  month: "short",
  day: "numeric",
};

/**
 * Date navigator (◀ label ▶ + Today). The whole app scopes to `selectedDate`
 * (see DateProvider), so stepping here reflows the calendar to that grid day.
 * Clicking the label opens a custom MiniCalendar to jump to any day.
 */
export function DateBar() {
  const { selectedDate, setSelectedDate, goPrevDay, goNextDay, goToday, isToday } =
    useSelectedDate();
  const [pickerOpen, setPickerOpen] = useState(false);
  const locale = useLocale();
  const t = useTranslations("calendar");
  const label = selectedDate.toLocaleDateString(locale, DATE_LABEL);

  const arrow =
    "rounded-md px-2 py-1 text-lg leading-none text-muted transition-colors hover:bg-accent-soft hover:text-foreground";

  return (
    <div className="flex items-center justify-center gap-2">
      <button type="button" onClick={goPrevDay} aria-label={t("prevDay")} className={arrow}>
        ‹
      </button>

      <div className="relative">
        <button
          type="button"
          onClick={() => setPickerOpen((o) => !o)}
          aria-label={t("pickDate")}
          className="min-w-32 rounded-md px-2 py-1 text-center text-sm font-medium text-foreground transition-colors hover:bg-accent-soft"
        >
          {label}
        </button>
        {pickerOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setPickerOpen(false)} />
            <div className="absolute left-1/2 z-20 mt-1 -translate-x-1/2 rounded-xl border border-border bg-panel p-3 shadow-lg">
              <MiniCalendar
                selected={selectedDate}
                onSelect={(d) => {
                  setSelectedDate(d);
                  setPickerOpen(false);
                }}
              />
            </div>
          </>
        )}
      </div>

      <button type="button" onClick={goNextDay} aria-label={t("nextDay")} className={arrow}>
        ›
      </button>
      <button
        type="button"
        onClick={goToday}
        disabled={isToday}
        className="ml-1 rounded-md border border-border px-2.5 py-1 text-xs text-muted transition-colors hover:bg-accent-soft hover:text-foreground disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-muted"
      >
        {t("today")}
      </button>
    </div>
  );
}
