"use client";

import { useEffect } from "react";

/**
 * The browser's native anchor scrolling fires before the page has measured the
 * sticky header height — the targeted entry lands under it. Re-trigger the
 * scroll after first paint so `scroll-mt-*` is honored.
 */
export function ChangelogAnchorScroll() {
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash || hash.length < 2) return;
    // Defer to next frame so layout is finalized.
    const id = window.requestAnimationFrame(() => {
      const target = document.getElementById(hash.slice(1));
      if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return () => window.cancelAnimationFrame(id);
  }, []);

  return null;
}
