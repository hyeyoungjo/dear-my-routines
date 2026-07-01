"use client";

import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBars, faXmark } from "@fortawesome/free-solid-svg-icons";
import { useTranslations } from "next-intl";
import { FeedbackButton } from "@/components/FeedbackButton";
import { GuideButton } from "@/components/GuideButton";
import { KofiButton } from "@/components/KofiButton";
import { ThemeMenu } from "@/components/ThemeMenu";
import { SignOutButton } from "@/components/SignOutButton";
import { LeftPanelToggle } from "@/components/AppSidebar";

/**
 * Mobile-only hamburger that collapses the header actions into one menu, each
 * shown as an icon + label row. Desktop keeps the inline icon row (in page.tsx).
 *
 * The action components render their own popovers/modals *inside* their menu row,
 * so we must NOT unmount the dropdown when an item is tapped (that would kill the
 * modal it just opened). Instead the dropdown sits at a low z-index (z-20) and
 * each modal's full-screen backdrop (z-30+) covers it; an outside tap closes the
 * dropdown when no modal is up.
 */
export function HeaderMenu({
  userEmail,
  isAdmin,
  signOut,
}: {
  userEmail: string;
  isAdmin: boolean;
  signOut: () => Promise<void>;
}) {
  const t = useTranslations("nav");
  const [open, setOpen] = useState(false);

  return (
    <div className="relative sm:hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={t("menu")}
        aria-expanded={open}
        className="rounded-md p-1 text-xl leading-none text-muted transition-colors hover:bg-accent-soft hover:text-foreground"
      >
        <FontAwesomeIcon icon={open ? faXmark : faBars} fixedWidth />
      </button>

      {open && (
        <>
          {/* Outside tap closes the menu (when no modal is up). */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
            role="presentation"
          />
          <div className="absolute right-0 top-full z-20 mt-2 w-56 rounded-lg border border-border bg-panel p-1 shadow-xl">
            <GuideButton variant="menu" />
            <FeedbackButton userEmail={userEmail} variant="menu" />
            <KofiButton variant="menu" />
            <LeftPanelToggle variant="menu" />
            <ThemeMenu isAdmin={isAdmin} variant="menu" />
            <SignOutButton action={signOut} variant="menu" />
          </div>
        </>
      )}
    </div>
  );
}
