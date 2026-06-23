"use client";

import { useState } from "react";

export function useExport(): {
  download: (from: string, to: string) => Promise<void>;
  isPending: boolean;
  error: string | null;
} {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function download(from: string, to: string): Promise<void> {
    setIsPending(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/export?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      );
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? `Export failed (${res.status})`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `dear-my-routines-${from}-${to}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Export failed";
      setError(msg);
      throw err;
    } finally {
      setIsPending(false);
    }
  }

  return { download, isPending, error };
}
