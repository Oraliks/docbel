'use client';

import { useEffect } from 'react';

/**
 * Hook for handling global keyboard shortcuts
 * Usage: useKeyboardShortcut('e', () => handleEdit(), true)
 * The third param enables Ctrl/Cmd modifier requirement
 */
export const useKeyboardShortcut = (
  key: string,
  callback: () => void,
  requireModifier = true,
  enabled = true
) => {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const hasModifier = e.ctrlKey || e.metaKey;

      if (requireModifier) {
        if (e.key.toLowerCase() === key.toLowerCase() && hasModifier) {
          e.preventDefault();
          callback();
        }
      } else {
        if (e.key.toLowerCase() === key.toLowerCase()) {
          e.preventDefault();
          callback();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [key, callback, requireModifier, enabled]);
};
