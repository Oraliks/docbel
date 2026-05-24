"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { RefreshCw, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Endpoint {
  /** Label court affiché à côté du dot. */
  name: string;
  /** URL à ping. Les params éventuels doivent être valides (sinon 400). */
  url: string;
}

/**
 * Liste d'endpoints critiques à monitorer.
 * Sélection : ce qui fait tourner les pages publiques principales
 * (resolver bureaux, lookup ONEM, baremes) + admin essentiels (health,
 * activities, inbox, organismes). Pas exhaustif — juste ce qui doit
 * marcher pour que l'app soit "utilisable".
 */
const ENDPOINTS: Endpoint[] = [
  { name: "Bureaux resolver", url: "/api/bureaux/resolve?cp=1000" },
  { name: "Bureaux santé", url: "/api/admin/bureaux/health" },
  { name: "Bureaux annuaire", url: "/api/admin/bureaux?limit=1" },
  { name: "Lookup ONEM", url: "/api/lookup/search?q=s01" },
  { name: "Activités", url: "/api/activities?limit=1" },
  { name: "Inbox", url: "/api/inbox/stats" },
  { name: "Organismes", url: "/api/documents/organismes" },
  { name: "Communes", url: "/api/admin/communes?limit=1" },
];

type Status = "ok" | "slow" | "warn" | "fail" | "pending";

interface CheckResult {
  status: Status;
  ms: number | null;
  code: number | null;
}

/**
 * Ping un endpoint et catégorise :
 *  - 2xx/3xx       : ok (ou slow si > 800 ms)
 *  - 4xx (401/403) : warn (probablement auth ou param invalide, mais l'API
 *                    répond donc pas "down")
 *  - 5xx           : fail
 *  - timeout/réseau : fail
 *
 * cache: 'no-store' pour ne pas mesurer le cache navigateur à la place.
 */
async function check(ep: Endpoint, signal: AbortSignal): Promise<CheckResult> {
  const start = performance.now();
  try {
    const r = await fetch(ep.url, { signal, cache: "no-store" });
    const ms = Math.round(performance.now() - start);
    let status: Status = "fail";
    if (r.ok) status = ms > 800 ? "slow" : "ok";
    else if (r.status >= 400 && r.status < 500) status = "warn";
    return { status, ms, code: r.status };
  } catch {
    return { status: "fail", ms: null, code: null };
  }
}

function relativeShort(d: Date): string {
  const sec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m`;
  return `${Math.floor(sec / 3600)}h`;
}

/**
 * Bandeau d'API status pour le dashboard admin.
 *
 * UX :
 *  - 1 dot coloré + label court + latence ms par endpoint, en ligne
 *  - Refresh auto toutes les 30 s, ou manuel via bouton
 *  - Overall status à gauche (vert/orange/rouge selon le pire endpoint)
 *  - Timeout 5 s par check, parallèle (Promise.allSettled)
 */
export function ApiHealthCheck() {
  const [results, setResults] = useState<Record<string, CheckResult>>({});
  const [lastRun, setLastRun] = useState<Date | null>(null);
  const [running, setRunning] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  // Tick pour rafraîchir l'affichage "Xs ago" sans relancer les checks
  const [, setTick] = useState(0);

  const runAll = useCallback(async () => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    const timeoutId = setTimeout(() => ac.abort(), 5000);

    setRunning(true);
    // Init tous en pending pour feedback immédiat
    setResults((prev) => {
      const next = { ...prev };
      for (const ep of ENDPOINTS) {
        next[ep.url] = { status: "pending", ms: null, code: null };
      }
      return next;
    });

    const checks = await Promise.allSettled(
      ENDPOINTS.map((ep) => check(ep, ac.signal).then((r) => [ep.url, r] as const)),
    );

    clearTimeout(timeoutId);
    const map: Record<string, CheckResult> = {};
    for (const c of checks) {
      if (c.status === "fulfilled") {
        map[c.value[0]] = c.value[1];
      }
    }
    setResults(map);
    setLastRun(new Date());
    setRunning(false);
  }, []);

  // Run au montage + intervalle 30 s
  useEffect(() => {
    void runAll();
    const interval = setInterval(() => void runAll(), 30_000);
    return () => {
      clearInterval(interval);
      abortRef.current?.abort();
    };
  }, [runAll]);

  // Refresh visuel du "Xs ago" toutes les secondes (sans re-ping)
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // Status global = pire endpoint
  const overall: Status = (() => {
    const statuses = Object.values(results).map((r) => r.status);
    if (statuses.length === 0) return "pending";
    if (statuses.some((s) => s === "fail")) return "fail";
    if (statuses.some((s) => s === "warn" || s === "slow")) return "slow";
    if (statuses.some((s) => s === "pending")) return "pending";
    return "ok";
  })();

  const overallLabel = {
    ok: "Tout OK",
    slow: "Dégradé",
    warn: "Dégradé",
    fail: "Incident",
    pending: "Test…",
  }[overall];

  return (
    <Card>
      <CardContent className="p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {/* Label section + overall */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              API
            </span>
            <StatusBadge status={overall} label={overallLabel} />
          </div>

          {/* Endpoints en ligne, wrap si trop nombreux */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 flex-1 min-w-0">
            {ENDPOINTS.map((ep) => {
              const r = results[ep.url] ?? { status: "pending" as Status, ms: null, code: null };
              return <EndpointPill key={ep.url} name={ep.name} result={r} />;
            })}
          </div>

          {/* Refresh + temps depuis dernier check */}
          <button
            type="button"
            onClick={() => void runAll()}
            disabled={running}
            className="ml-auto inline-flex items-center gap-1.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 shrink-0"
            title="Relancer les checks"
          >
            {running ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <RefreshCw className="size-3" />
            )}
            {lastRun ? relativeShort(lastRun) : "—"}
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────

function EndpointPill({ name, result }: { name: string; result: CheckResult }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[11px]"
      title={
        result.code !== null
          ? `${name} — HTTP ${result.code}${result.ms !== null ? ` · ${result.ms} ms` : ""}`
          : name
      }
    >
      <StatusDot status={result.status} />
      <span className="font-medium text-foreground/80">{name}</span>
      {result.ms !== null && (
        <span className="text-muted-foreground tabular-nums">{result.ms}ms</span>
      )}
    </span>
  );
}

function StatusDot({ status }: { status: Status }) {
  const color = {
    ok: "bg-emerald-500",
    slow: "bg-amber-500",
    warn: "bg-amber-500",
    fail: "bg-rose-500",
    pending: "bg-muted-foreground/40",
  }[status];
  return (
    <span className="relative inline-flex size-2 shrink-0">
      {status === "pending" && (
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-muted-foreground/60 opacity-60" />
      )}
      <span className={cn("relative inline-flex size-2 rounded-full", color)} />
    </span>
  );
}

function StatusBadge({ status, label }: { status: Status; label: string }) {
  const cls = {
    ok: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10",
    slow: "text-amber-600 dark:text-amber-400 bg-amber-500/10",
    warn: "text-amber-600 dark:text-amber-400 bg-amber-500/10",
    fail: "text-rose-600 dark:text-rose-400 bg-rose-500/10",
    pending: "text-muted-foreground bg-muted",
  }[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
        cls,
      )}
    >
      <StatusDot status={status} />
      {label}
    </span>
  );
}
