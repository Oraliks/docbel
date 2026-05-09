"use client";

import { useEffect } from "react";

interface ShortcutHandlers {
  onNextEmail?: () => void;
  onPrevEmail?: () => void;
  onArchive?: () => void;
  onDelete?: () => void;
  onReply?: () => void;
  onForward?: () => void;
  onToggleStar?: () => void;
  onMarkUnread?: () => void;
  onSearch?: () => void;
  onEscape?: () => void;
  onRefresh?: () => void;
}

const TYPING_SELECTOR = 'input, textarea, select, [contenteditable="true"]';

export function useKeyboardShortcuts(handlers: ShortcutHandlers) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // Don't intercept while typing in an input/textarea — except Escape
      if (e.key !== "Escape" && (e.target as HTMLElement)?.matches?.(TYPING_SELECTOR)) {
        return;
      }
      // Don't fire on combos (cmd/ctrl/alt) — those are reserved for browser
      if (e.metaKey || e.altKey || (e.ctrlKey && e.key !== "/")) return;

      let handled = false;
      switch (e.key) {
        case "j":
        case "ArrowDown":
          if (handlers.onNextEmail) {
            handlers.onNextEmail();
            handled = true;
          }
          break;
        case "k":
        case "ArrowUp":
          if (handlers.onPrevEmail) {
            handlers.onPrevEmail();
            handled = true;
          }
          break;
        case "e":
          if (handlers.onArchive) {
            handlers.onArchive();
            handled = true;
          }
          break;
        case "#":
        case "Delete":
        case "Backspace":
          if (e.key === "Backspace" && (e.target as HTMLElement)?.matches?.(TYPING_SELECTOR)) break;
          if (handlers.onDelete) {
            handlers.onDelete();
            handled = true;
          }
          break;
        case "r":
          if (handlers.onReply) {
            handlers.onReply();
            handled = true;
          }
          break;
        case "f":
          if (handlers.onForward) {
            handlers.onForward();
            handled = true;
          }
          break;
        case "s":
          if (handlers.onToggleStar) {
            handlers.onToggleStar();
            handled = true;
          }
          break;
        case "u":
          if (handlers.onMarkUnread) {
            handlers.onMarkUnread();
            handled = true;
          }
          break;
        case "/":
          if (handlers.onSearch) {
            handlers.onSearch();
            handled = true;
          }
          break;
        case "Escape":
          if (handlers.onEscape) {
            handlers.onEscape();
            handled = true;
          }
          break;
        case ".":
          if (handlers.onRefresh) {
            handlers.onRefresh();
            handled = true;
          }
          break;
      }
      if (handled) e.preventDefault();
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [handlers]);
}
