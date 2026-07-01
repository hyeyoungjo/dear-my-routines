"use client";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowRightFromBracket } from "@fortawesome/free-solid-svg-icons";
import { useTranslations } from "next-intl";

/**
 * Sign-out button split into a client component so its label can be localized
 * via next-intl (a client-only hook), while the actual sign-out remains a
 * server action passed in by the host page. The host also supplies `className`
 * since the home header and the unauthorized page style the button differently.
 * `variant="menu"` renders it as an icon+label row for the mobile hamburger.
 */
export function SignOutButton({
  action,
  className,
  variant = "custom",
}: {
  action: () => Promise<void>;
  className?: string;
  variant?: "custom" | "menu";
}) {
  const t = useTranslations("auth");
  if (variant === "menu") {
    return (
      <form action={action}>
        <button
          type="submit"
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-accent-soft"
        >
          <FontAwesomeIcon icon={faArrowRightFromBracket} fixedWidth />
          {t("signOut")}
        </button>
      </form>
    );
  }
  return (
    <form action={action}>
      <button type="submit" className={className}>
        {t("signOut")}
      </button>
    </form>
  );
}
