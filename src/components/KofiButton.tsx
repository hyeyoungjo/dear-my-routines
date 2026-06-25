"use client";

import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMugHot, faXmark } from "@fortawesome/free-solid-svg-icons";

/**
 * Header ☕ button that opens the Ko-fi donation form in a popover anchored
 * right below the icon (not a centered modal — that felt too heavy). The form
 * is an embedded iframe so the user never leaves the app; a transparent
 * full-screen layer behind the popover catches outside clicks to close it.
 * The embed needs no CSP change (none is set).
 */
const KOFI_EMBED_SRC =
  "https://ko-fi.com/heyyoungsoul/?hidefeed=true&widget=true&embed=true&preview=true";
const KOFI_PAGE_URL = "https://ko-fi.com/heyyoungsoul";

export function KofiButton() {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Support on Ko-fi"
        title="Support on Ko-fi"
        className="rounded-md p-1 text-xl leading-none text-muted transition-colors hover:bg-accent-soft hover:text-foreground"
      >
        <FontAwesomeIcon icon={faMugHot} fixedWidth />
      </button>

      {open && (
        <>
          {/* Outside-click closes it. Dimmed on mobile (the popover centers as a
              modal there); a transparent click-catcher on desktop. */}
          <div
            className="fixed inset-0 z-30 bg-black/40 sm:bg-transparent"
            onClick={() => setOpen(false)}
          />
          {/* Mobile: centered modal. Desktop (sm+): popover anchored under the icon. */}
          <div
            role="dialog"
            aria-label="Support on Ko-fi"
            className="fixed left-1/2 top-1/2 z-40 flex w-[290px] max-w-[92vw] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg border border-border bg-panel shadow-xl sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:translate-x-0 sm:translate-y-0"
          >
            <div className="flex items-center justify-between border-b border-border px-2 py-1">
              <a
                href={KOFI_PAGE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="px-1 text-xs text-muted underline-offset-2 hover:text-foreground hover:underline"
              >
                Open in Ko-fi
              </a>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="rounded p-1 text-base leading-none text-muted transition-colors hover:bg-accent-soft hover:text-foreground"
              >
                <FontAwesomeIcon icon={faXmark} />
              </button>
            </div>
            {/* Scale the whole form down (not resize it) so nothing reflows and
                no scrollbar appears; the wrapper is sized to the scaled box. */}
            <div className="h-[553px] w-[290px] overflow-hidden">
              <iframe
                title="Ko-fi"
                src={KOFI_EMBED_SRC}
                className="h-[650px] w-[340px] origin-top-left scale-[0.853] bg-white"
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
