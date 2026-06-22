"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

/** One reversible step: how to undo it, and how to redo it. */
export type UndoCommand = { undo: () => void; redo: () => void };

const DEFAULT_MAX = 10;
const MAX_KEY = "undoMax";
const MAX_LIMIT = 50;

type UndoValue = {
  /** Push a command (no-op while replaying — callers pass fromHistory then). */
  record: (cmd: UndoCommand) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  /** History depth cap, persisted in localStorage and tunable in settings. */
  max: number;
  setMax: (n: number) => void;
};

const UndoContext = createContext<UndoValue | null>(null);

export const useUndo = () => {
  const ctx = useContext(UndoContext);
  if (!ctx) throw new Error("useUndo must be used within an UndoProvider");
  return ctx;
};

/**
 * App-wide undo/redo for node edits (ADR-007 smooth UX). Each mutation records
 * an inverse command (see hooks/nodes); Cmd/Ctrl+Z replays it, Shift adds redo.
 * Commands replay through the same optimistic mutations with `fromHistory: true`
 * so they don't re-record — no timing/flag races. The stack is capped at `max`.
 */
export function UndoProvider({ children }: { children: React.ReactNode }) {
  const past = useRef<UndoCommand[]>([]);
  const future = useRef<UndoCommand[]>([]);
  const [max, setMaxState] = useState(DEFAULT_MAX);
  // Bump to re-render so undo/redo affordances reflect stack state.
  const [, bump] = useState(0);
  const rerender = useCallback(() => bump((n) => n + 1), []);

  useEffect(() => {
    const saved = Number(localStorage.getItem(MAX_KEY));
    if (Number.isFinite(saved) && saved >= 1) setMaxState(Math.min(saved, MAX_LIMIT));
  }, []);

  const setMax = useCallback(
    (n: number) => {
      const clamped = Math.max(1, Math.min(MAX_LIMIT, Math.round(n)));
      setMaxState(clamped);
      localStorage.setItem(MAX_KEY, String(clamped));
      if (past.current.length > clamped) {
        past.current = past.current.slice(-clamped);
        rerender();
      }
    },
    [rerender],
  );

  const record = useCallback(
    (cmd: UndoCommand) => {
      past.current.push(cmd);
      if (past.current.length > max) past.current.shift();
      future.current = [];
      rerender();
    },
    [max, rerender],
  );

  const undo = useCallback(() => {
    const cmd = past.current.pop();
    if (!cmd) return;
    cmd.undo();
    future.current.push(cmd);
    rerender();
  }, [rerender]);

  const redo = useCallback(() => {
    const cmd = future.current.pop();
    if (!cmd) return;
    cmd.redo();
    past.current.push(cmd);
    rerender();
  }, [rerender]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod || e.key.toLowerCase() !== "z") return;
      // Inside a text field, let the browser's native text undo win.
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.isContentEditable)
      ) {
        return;
      }
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  return (
    <UndoContext.Provider
      value={{
        record,
        undo,
        redo,
        canUndo: past.current.length > 0,
        canRedo: future.current.length > 0,
        max,
        setMax,
      }}
    >
      {children}
    </UndoContext.Provider>
  );
}
