"use client";

import { useEffect, useState } from "react";
import { NextIntlClientProvider } from "next-intl";
import { DEFAULT_LANGUAGE_ID, isAllowedLanguage, type LanguageId } from "@/lib/languages";
import { useUserSettings } from "@/hooks/userSettings";
import en from "./messages/en.json";
import ko from "./messages/ko.json";

const messages: Record<LanguageId, typeof en> = { en, ko };

const GUEST_LOCALE_KEY = "dmr-locale";
export const GUEST_LOCALE_EVENT = "dmr-locale-change";

function readGuestLocale(): LanguageId {
  if (typeof window === "undefined") return DEFAULT_LANGUAGE_ID;
  const saved = localStorage.getItem(GUEST_LOCALE_KEY);
  return isAllowedLanguage(saved) ? saved : DEFAULT_LANGUAGE_ID;
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const { data: settings } = useUserSettings();
  // Start from the server-default locale so the first client render matches the
  // SSR'd HTML (localStorage isn't available on the server). The saved guest
  // locale is read after mount in the effect below — avoids a hydration mismatch.
  const [guestLocale, setGuestLocale] = useState<LanguageId>(DEFAULT_LANGUAGE_ID);

  // Read the saved locale on mount, and re-read when the login page fires a
  // locale-change event (same-tab).
  useEffect(() => {
    setGuestLocale(readGuestLocale());
    const handler = () => setGuestLocale(readGuestLocale());
    window.addEventListener(GUEST_LOCALE_EVENT, handler);
    return () => window.removeEventListener(GUEST_LOCALE_EVENT, handler);
  }, []);

  // Authenticated user's DB setting wins; guest localStorage is the fallback.
  const locale = (settings?.language ?? guestLocale) as LanguageId;

  // next-intl needs an explicit timeZone or it logs an ENVIRONMENT_FALLBACK
  // warning (server vs. browser zone could disagree for date formatting). The
  // app already renders every time in the viewer's local zone (native Date /
  // toLocaleDateString), so resolve the browser's IANA zone and pass it through.
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return (
    <NextIntlClientProvider
      locale={locale}
      timeZone={timeZone}
      messages={messages[locale] ?? en}
    >
      {children}
    </NextIntlClientProvider>
  );
}
