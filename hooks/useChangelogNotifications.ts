"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "docbel:changelog:lastSeenAt";
const POLL_INTERVAL_MS = 5 * 60 * 1000;
const RECENT_LIMIT = 5;

export interface ChangelogNotification {
  id: string;
  version: string;
  publishedAt: string;
  type: "feature" | "fix" | "improvement" | "breaking";
  title: string;
  description: string;
}

interface ChangelogListResponse {
  entries: ChangelogNotification[];
}

function readLastSeenAt(): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return 0;
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

function writeLastSeenAt(ts: number) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, String(ts));
  } catch {
    // ignore (private mode, quota, etc.)
  }
}

export function useChangelogNotifications() {
  const [entries, setEntries] = useState<ChangelogNotification[]>([]);
  const [lastSeenAt, setLastSeenAt] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLastSeenAt(readLastSeenAt());
  }, []);

  const fetchEntries = useCallback(async () => {
    try {
      const res = await fetch(`/api/changelog?limit=${RECENT_LIMIT}`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = (await res.json()) as ChangelogListResponse;
      setEntries(data.entries ?? []);
    } catch {
      // network blip — retry next tick
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchEntries();

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void fetchEntries();
    }, POLL_INTERVAL_MS);

    const onVisibility = () => {
      if (document.visibilityState === "visible") void fetchEntries();
    };
    document.addEventListener("visibilitychange", onVisibility);

    // Cross-tab sync: another tab updated lastSeen → reflect here.
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setLastSeenAt(readLastSeenAt());
    };
    window.addEventListener("storage", onStorage);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("storage", onStorage);
    };
  }, [fetchEntries]);

  const unreadCount = useMemo(
    () =>
      entries.filter(
        (e) => new Date(e.publishedAt).getTime() > lastSeenAt,
      ).length,
    [entries, lastSeenAt],
  );

  const markAllRead = useCallback(() => {
    if (entries.length === 0) return;
    const newest = entries.reduce((max, e) => {
      const t = new Date(e.publishedAt).getTime();
      return t > max ? t : max;
    }, 0);
    if (newest > 0 && newest !== lastSeenAt) {
      writeLastSeenAt(newest);
      setLastSeenAt(newest);
    }
  }, [entries, lastSeenAt]);

  return {
    entries,
    unreadCount,
    lastSeenAt,
    loading,
    markAllRead,
    refresh: fetchEntries,
  };
}
