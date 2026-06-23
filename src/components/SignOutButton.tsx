"use client";

import { useTranslations } from "next-intl";

/**
 * Sign-out button split into a client component so its label can be localized
 * via next-intl (a client-only hook), while the actual sign-out remains a
 * server action passed in by the host page. The host also supplies `className`
 * since the home header and the unauthorized page style the button differently.
 */
export function SignOutButton({
  action,
  className,
}: {
  action: () => Promise<void>;
  className?: string;
}) {
  const t = useTranslations("auth");
  return (
    <form action={action}>
      <button type="submit" className={className}>
        {t("signOut")}
      </button>
    </form>
  );
}
