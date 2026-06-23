"use client";

import { useState } from "react";
import { dayKey } from "@/core/time/day";
import { useExport } from "@/hooks/useExport";
import { useTranslations } from "next-intl";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function ExportModal({ open, onClose }: Props) {
  const t = useTranslations("export");
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return dayKey(d);
  });
  const [to, setTo] = useState(() => dayKey(new Date()));
  const { download, isPending, error } = useExport();

  if (!open) return null;

  async function handleExport() {
    try {
      await download(from, to);
      onClose();
    } catch {
      // error already reflected in `error` state
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-30 bg-black/40" onClick={onClose} />
      <div className="fixed left-1/2 top-1/2 z-40 w-80 -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-panel p-4 shadow-xl">
        <h2 className="mb-3 text-base font-medium text-foreground">
          {t("title")}
        </h2>
        <div className="space-y-3">
          <label className="flex items-center justify-between gap-2 text-sm text-foreground">
            <span>{t("from")}</span>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="rounded border border-border bg-transparent px-2 py-1 text-foreground focus:border-accent focus:outline-none"
            />
          </label>
          <label className="flex items-center justify-between gap-2 text-sm text-foreground">
            <span>{t("to")}</span>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="rounded border border-border bg-transparent px-2 py-1 text-foreground focus:border-accent focus:outline-none"
            />
          </label>
        </div>
        {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded px-3 py-1.5 text-sm text-muted transition-colors hover:bg-accent-soft hover:text-foreground"
          >
            {t("cancel")}
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={isPending}
            className="rounded bg-accent px-3 py-1.5 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
          >
            {isPending ? t("exporting") : t("exportCsv")}
          </button>
        </div>
      </div>
    </>
  );
}
