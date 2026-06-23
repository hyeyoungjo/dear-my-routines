"use client";

import { DEFAULT_LANGUAGE_ID, type LanguageId } from "@/lib/languages";
import { useUserSettings } from "@/hooks/userSettings";
import { I18nContext } from "@/i18n/context";
import en from "./messages/en.json";
import ko from "./messages/ko.json";

const messages: Record<LanguageId, typeof en> = { en, ko };

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const { data: settings } = useUserSettings();
  const locale = (settings?.language ?? DEFAULT_LANGUAGE_ID) as LanguageId;
  return (
    <I18nContext.Provider value={{ locale, messages: messages[locale] ?? en }}>
      {children}
    </I18nContext.Provider>
  );
}
