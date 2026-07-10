"use client";

// Carte "Santé API" : lit l'endpoint serveur unique /api/health (résumé caché),
// refresh 60 s. Plus de fan-out client, plus de 4xx compté comme échec, plus
// de timeout batch arbitraire — l'état vient d'un vrai check serveur (ping DB).
import { useCallback, useEffect, useState } from "react";
import { Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import type { HealthStatus } from "@/lib/health/types";

interface CardState {
  status: HealthStatus | "pending" | "unreachable";
  dbLatencyMs: number | null;
}

export function ApiHealthCard() {
  const [state, setState] = useState<CardState>({ status: "pending", dbLatencyMs: null });

  const run = useCallback(async () => {
    const ac = new AbortController();
    const timeout = setTimeout(() => ac.abort(), 8000);
    try {
      const r = await fetch("/api/health", { signal: ac.signal, cache: "no-store" });
      const data = (await r.json()) as { status: HealthStatus; db: { latencyMs: number | null } };
      setState({ status: data.status, dbLatencyMs: data.db.latencyMs });
    } catch {
      // Réseau/timeout : l'endpoint lui-même est injoignable → "unreachable"
      // (distinct de "down" qui vient du check DB serveur).
      setState({ status: "unreachable", dbLatencyMs: null });
    } finally {
      clearTimeout(timeout);
    }
  }, []);

  useEffect(() => {
    void run();
    const interval = setInterval(() => void run(), 60_000);
    return () => clearInterval(interval);
  }, [run]);

  const label = {
    ok: "OK",
    degraded: "Dégradé",
    down: "Incident",
    unreachable: "Injoignable",
    pending: "…",
  }[state.status];

  const valueCls = {
    ok: "text-emerald-600 dark:text-emerald-400",
    degraded: "text-amber-600 dark:text-amber-400",
    down: "text-rose-600 dark:text-rose-400",
    unreachable: "text-rose-600 dark:text-rose-400",
    pending: "text-muted-foreground",
  }[state.status];

  return (
    <div className="rounded-xl border bg-card px-4 py-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-muted-foreground">Santé API</p>
        <span className="flex size-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
          <Activity className="size-3.5" />
        </span>
      </div>
      <p className={cn("mt-1 text-xl font-medium", valueCls)}>{label}</p>
      <p className="font-mono text-[11px] text-muted-foreground">
        {state.dbLatencyMs !== null ? `DB ${state.dbLatencyMs} ms` : "—"}
      </p>
    </div>
  );
}
