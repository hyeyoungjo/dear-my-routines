"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { DateProvider } from "@/components/date";
import { ThemeProvider } from "@/components/theme";
import { UndoProvider } from "@/components/undo";
import { I18nProvider } from "@/i18n/provider";
import { FontProvider } from "@/components/font";
import { useCarryOverSweep } from "@/hooks/useCarryOverSweep";

/**
 * Mount point for the day-boundary carry-over sweep. Renders nothing — it just
 * runs the hook once, and must sit inside QueryClientProvider so it can read the
 * `nodes` cache (see useCarryOverSweep).
 */
function CarryOverSweep() {
  useCarryOverSweep();
  return null;
}

/**
 * App-wide client providers.
 *
 * `QueryClient` is created lazily inside `useState` so it is instantiated once
 * per browser session and never recreated on re-render — otherwise every render
 * would wipe the cache that our optimistic updates depend on (ADR-007).
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <UndoProvider>
          <DateProvider>
            <I18nProvider>
              <FontProvider>
                <CarryOverSweep />
                {children}
              </FontProvider>
            </I18nProvider>
          </DateProvider>
        </UndoProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
