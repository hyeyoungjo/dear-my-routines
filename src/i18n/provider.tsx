"use client";

import { NextIntlClientProvider } from "next-intl";
import { DEFAULT_LANGUAGE_ID, type LanguageId } from "@/lib/languages";
import { useUserSettings } from "@/hooks/userSettings";
import en from "./messages/en.json";
import ko from "./messages/ko.json";

const messages: Record<LanguageId, typeof en> = { en, ko };

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const { data: settings } = useUserSettings();
  const locale = (settings?.language ?? DEFAULT_LANGUAGE_ID) as LanguageId;
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
