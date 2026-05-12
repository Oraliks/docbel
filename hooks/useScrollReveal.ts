"use client";

import { useEffect, useState } from "react";

/**
 * Returns `true` while the header should be visible. The reveal behaves like
 * a typical app bar: hides past a small threshold when scrolling down,
 * comes back as soon as the user scrolls up. Always visible near the top.
 */
export function useScrollReveal(threshold = 64) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    let lastY = window.scrollY;
    let ticking = false;

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        const y = window.scrollY;
        const dy = y - lastY;

        if (y < threshold) {
          setVisible(true);
        } else if (dy > 4) {
          setVisible(false);
        } else if (dy < -4) {
          setVisible(true);
        }

        lastY = y;
        ticking = false;
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);

  return visible;
}
