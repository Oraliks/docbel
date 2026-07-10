"use client";

// Carte compacte « Santé API » : ping des mêmes endpoints critiques que
// l'ancien bandeau ApiHealthCheck (supprimé en Task 8), refresh 60 s.
import { useCallback, useEffect, useState } from "react";
import { Activity } from "lucide-react";
import { cn } from "@/lib/utils";

const ENDPOINTS = [
  "/api/bureaux/resolve?cp=1000",
  "/api/admin/bureaux/health",
  "/api/lookup/search?q=s01",
  "/api/activities?limit=1",
  "/api/inbox/stats",
  "/api/documents/organismes",
];

type Overall = "ok" | "degraded" | "down" | "pending";

interface HealthState {
  overall: Overall;
  avgMs: number | null;
  failing: number;
}

async function checkAll(signal: AbortSignal): Promise<HealthState> {
  const results = await Promise.allSettled(
    ENDPOINTS.map(async (url) => {
      const start = performance.now();
      const r = await fetch(url, { signal, cache: "no-store" });
      return { ok: r.ok, ms: Math.round(performance.now() - start) };
    }),
  );
  let okCount = 0;
  let msSum = 0;
  for (const r of results) {
    if (r.status === "fulfilled" && r.value.ok) {
      okCount++;
      msSum += r.value.ms;
    }
  }
  const failing = ENDPOINTS.length - okCount;
  const overall: Overall = failing === 0 ? "ok" : failing < ENDPOINTS.length ? "degraded" : "down";
  return { overall, avgMs: okCount > 0 ? Math.round(msSum / okCount) : null, failing };
}

export function ApiHealthCard() {
  const [state, setState] = useState<HealthState>({
    overall: "pending",
    avgMs: null,
    failing: 0,
  });

  const run = useCallback(async () => {
    const ac = new AbortController();
    const timeout = setTimeout(() => ac.abort(), 5000);
    try {
      setState(await checkAll(ac.signal));
    } catch {
      setState({ overall: "down", avgMs: null, failing: ENDPOINTS.length });
    } finally {
      clearTimeout(timeout);
    }
  }, []);

  useEffect(() => {
    void run();
    const interval = setInterval(() => void run(), 60_000);
    return () => clearInterval(interval);
  }, [run]);

  const value = { ok: "OK", degraded: "Dégradé", down: "Incident", pending: "…" }[state.overall];
  const valueCls = {
    ok: "text-emerald-600 dark:text-emerald-400",
    degraded: "text-amber-600 dark:text-amber-400",
    down: "text-rose-600 dark:text-rose-400",
    pending: "text-muted-foreground",
  }[state.overall];

  return (
    <div className="rounded-xl border bg-card px-4 py-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-muted-foreground">Santé API</p>
        <span className="flex size-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
          <Activity className="size-3.5" />
        </span>
      </div>
      <p className={cn("mt-1 text-xl font-medium", valueCls)}>{value}</p>
      <p className="font-mono text-[11px] text-muted-foreground">
        {state.avgMs !== null
          ? `${ENDPOINTS.length - state.failing}/${ENDPOINTS.length} · ${state.avgMs} ms`
          : `${ENDPOINTS.length} endpoints`}
      </p>
    </div>
  );
}
