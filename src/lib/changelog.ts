import type { LanguageId } from "@/lib/languages";

/**
 * Update entries shown in the guide's "Update" list, newest first. Each release
 * adds one one-line entry at the TOP; the first entry's `date` is what the guide
 * button's "new" dot compares against (localStorage "last seen"). Text is inline
 * per locale so a release is one object to append.
 */
export type ChangelogEntry = {
  /** Release date, YYYY-MM-DD. Sorted newest-first in the array. */
  date: string;
  /** One short line per locale. */
  text: Record<LanguageId, string>;
};

export const CHANGELOG: ChangelogEntry[] = [
  {
    date: "2026-07-02",
    text: {
      en: "Continue later — defer a task to later today, tomorrow, or a specific date from the → button",
      ko: "이어서 하기 — → 버튼으로 task를 오늘 이따가·내일·특정 날짜로 미루기",
    },
  },
  {
    date: "2026-07-01",
    text: { en: "Shelf feature added", ko: "선반 기능 추가" },
  },
  {
    date: "2026-06-24",
    text: { en: "Dear My Routines launched 🎉", ko: "Dear My Routines 출시 🎉" },
  },
];

/** The most recent entry's date — the guide button's "new" comparison key. */
export const LATEST_CHANGELOG_DATE = CHANGELOG[0]?.date ?? "";
