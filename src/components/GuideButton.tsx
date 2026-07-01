"use client";

import { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCircleQuestion } from "@fortawesome/free-solid-svg-icons";
import { useTranslations } from "next-intl";
import { LATEST_CHANGELOG_DATE } from "@/lib/changelog";
import { GuideModal } from "@/components/guide/GuideModal";

/** localStorage key: the newest changelog date the user has opened the guide at. */
export const GUIDE_SEEN_KEY = "dmr-guide-seen";

/**
 * Header button that opens the guide window (usage + what's new). A red dot marks
 * a changelog entry newer than the last time the user opened the guide — that's
 * how new features get surfaced. The dot is client-only (localStorage) and
 * mounted-gated to avoid a hydration mismatch; opening the guide marks it seen.
 * `variant="menu"` is the mobile hamburger row.
 */
export function GuideButton({ variant = "icon" }: { variant?: "icon" | "menu" }) {
  const t = useTranslations("guide");
  const [open, setOpen] = useState(false);
  const [hasNew, setHasNew] = useState(false);

  useEffect(() => {
    const seen = localStorage.getItem(GUIDE_SEEN_KEY);
    setHasNew(!seen || seen < LATEST_CHANGELOG_DATE);
  }, []);

  const openGuide = () => {
    localStorage.setItem(GUIDE_SEEN_KEY, LATEST_CHANGELOG_DATE);
    setHasNew(false);
    setOpen(true);
  };

  return (
    <>
      {variant === "menu" ? (
        <button
          type="button"
          onClick={openGuide}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-accent-soft"
        >
          <FontAwesomeIcon icon={faCircleQuestion} fixedWidth />
          {t("title")}
          {hasNew && (
            <span className="ml-auto rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
              {t("newBadge")}
            </span>
          )}
        </button>
      ) : (
        <button
          type="button"
          onClick={openGuide}
          aria-label={t("title")}
          title={t("title")}
          className="relative rounded-md p-1 text-xl leading-none text-muted transition-colors hover:bg-accent-soft hover:text-foreground"
        >
          <FontAwesomeIcon icon={faCircleQuestion} fixedWidth />
          {hasNew && (
            <span className="absolute right-0.5 top-0.5 size-2 rounded-full bg-red-500 ring-2 ring-panel" />
          )}
        </button>
      )}

      {open && <GuideModal onClose={() => setOpen(false)} />}
    </>
  );
}
