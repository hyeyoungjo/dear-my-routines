"use client";

import { useEffect } from "react";
import { DEFAULT_FONT_ID, isAllowedFont } from "@/lib/fonts";
import { useUserSettings } from "@/hooks/userSettings";

/**
 * Reflects the user's font preference as `data-font` on <html>; globals.css maps
 * each id to a font-family. Unlike the theme (localStorage), the font lives in
 * `user_settings` (DB) like the language preference, so we read it from the
 * settings query. Default is "nanum-gothic" — the :root default in globals.css — so
 * FOUC is minimal before settings load. Renders nothing but its children.
 */
export function FontProvider({ children }: { children: React.ReactNode }) {
  const { data: settings } = useUserSettings();
  const font = isAllowedFont(settings?.font) ? settings.font : DEFAULT_FONT_ID;

  useEffect(() => {
    document.documentElement.dataset.font = font;
  }, [font]);

  return <>{children}</>;
}
