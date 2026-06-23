"use client";

import { createContext, useContext } from "react";
import type { LanguageId } from "@/lib/languages";

type Namespace = Record<string, string>;
type Messages = Record<string, Namespace>;
type Params = Record<string, string | number>;

function interpolate(template: string, params?: Params): string {
  if (!params) return template;
  return Object.entries(params).reduce(
    (str, [key, val]) => str.replaceAll(`{${key}}`, String(val)),
    template,
  );
}

export const I18nContext = createContext<{
  locale: LanguageId;
  messages: Messages;
}>({ locale: "en", messages: {} });

export function useTranslations(namespace: string) {
  const { messages } = useContext(I18nContext);
  const ns = messages[namespace] ?? {};
  return function t(key: string, params?: Params): string {
    return interpolate(ns[key] ?? key, params);
  };
}
