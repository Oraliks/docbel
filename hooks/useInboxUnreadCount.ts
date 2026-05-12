"use client";

import { useEffect, useState } from "react";

/**
 * Polls `/api/inbox/stats` for the current user's unread inbox count.
 *
 * - Polls every 30s while the tab is visible (no work in the background).
 * - Refreshes on tab focus.
 * - Listens for `inbox:stats-changed` window events — the messagerie panel
 *   dispatches that after marking messages read, so the badge updates
 *   without waiting for the next poll tick.
 */
export function useInboxUnreadCount() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const fetchCount = async () => {
      try {
        const res = await fetch("/api/inbox/stats");
        if (cancelled || !res.ok) return;
        const data = await res.json();
        setCount(data.unreadInbox ?? 0);
      } catch (error) {
        console.error("useInboxUnreadCount — fetch failed:", error);
      }
    };

    void fetchCount();

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void fetchCount();
    }, 30_000);

    const onVisibility = () => {
      if (document.visibilityState === "visible") void fetchCount();
    };
    document.addEventListener("visibilitychange", onVisibility);

    const onStatsChanged = () => void fetchCount();
    window.addEventListener("inbox:stats-changed", onStatsChanged);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("inbox:stats-changed", onStatsChanged);
    };
  }, []);

  return count;
}
