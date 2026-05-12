"use client";

import { useEffect } from "react";

const POLL_INTERVAL_MS = 5 * 60 * 1000;

// Module-scoped so the flag survives any remount of VersionWatcher and any
// re-run of the effect — one notification per page load, period.
let alreadyNotified = false;

export function useVersionCheck(onNewVersion: () => void) {
  useEffect(() => {
    const currentBuildId = process.env.NEXT_PUBLIC_BUILD_ID;
    if (!currentBuildId || currentBuildId === "dev") return;

    let cancelled = false;

    const check = async () => {
      if (alreadyNotified || cancelled || document.hidden) return;
      try {
        const res = await fetch("/api/version", { cache: "no-store" });
        if (!res.ok) return;
        const { buildId } = (await res.json()) as { buildId?: string };
        if (buildId && buildId !== currentBuildId && !cancelled && !alreadyNotified) {
          alreadyNotified = true;
          onNewVersion();
        }
      } catch {
        // network blip — retry on next tick
      }
    };

    const onVisible = () => {
      if (!document.hidden) void check();
    };

    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    const interval = window.setInterval(() => void check(), POLL_INTERVAL_MS);

    void check();

    return () => {
      cancelled = true;
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(interval);
    };
  }, [onNewVersion]);
}
