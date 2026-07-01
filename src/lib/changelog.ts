import type { LanguageId } from "@/lib/languages";

/**
 * What's-new entries shown on /guide, newest first. Each release adds one entry
 * at the TOP of the array; the first entry's `date` is what the guide button's
 * "new" dot compares against (localStorage "last seen"). Text is inline per
 * locale so a release is one object to append — no separate message-file edits.
 */
export type ChangelogEntry = {
  /** Release date, YYYY-MM-DD. Sorted newest-first in the array. */
  date: string;
  content: Record<LanguageId, { title: string; items: string[] }>;
};

export const CHANGELOG: ChangelogEntry[] = [
  {
    date: "2026-07-01",
    content: {
      en: {
        title: "Shelf — park non-urgent tasks",
        items: [
          "Shelve a task to take it off the daily carry-over: use the box button on a block, or the Shelf action in a task's details.",
          "Shelved tasks wait in the Shelf panel on the left (toggle it from the header; on mobile it opens as a drawer).",
          "Bring one back and it returns to today as a fresh plan.",
          "Shelved tasks are left out of the daily review and its stats.",
        ],
      },
      ko: {
        title: "선반(Shelf) — 급하지 않은 일 내려놓기",
        items: [
          "태스크를 선반에 올리면 매일 자동 이월에서 빠져요: 블록의 상자 버튼, 또는 상세창의 Shelf 버튼으로.",
          "내려둔 태스크는 왼쪽 선반 패널에서 기다려요 (헤더 버튼으로 열고 닫기, 모바일은 서랍으로 열림).",
          "다시 꺼내면 오늘 새 계획으로 돌아와요.",
          "선반에 올린 태스크는 데일리 리뷰와 통계에서 제외돼요.",
        ],
      },
    },
  },
];

/** The most recent entry's date — the guide button's "new" comparison key. */
export const LATEST_CHANGELOG_DATE = CHANGELOG[0]?.date ?? "";
