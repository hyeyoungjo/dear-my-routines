"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

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
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
