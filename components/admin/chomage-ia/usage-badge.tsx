"use client";

/**
 * UsageBadge — pill compact affichant la consommation IA cumulée du module
 * Assistant IA Chômage (tokens + coût estimé).
 *
 * Stratégie :
 *   - Composant client : fetch /api/chomage-ia/usage au mount.
 *   - Skeleton compact pendant le loading initial.
 *   - Pill avec Coins doré + total tokens + ≈ €coût.
 *   - Click → Popover détail avec breakdown par modèle + prompts.
 *
 * À insérer dans le header (server component) : ne nécessite aucune prop côté
 * server, l'API renvoie tout. `domain` configurable si besoin de scoper.
 */

import * as React from "react";
import { Coins, Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import {
  fmtCostEur,
  fmtCostUsd,
  fmtTokensCompact,
} from "@/lib/chomage-ia/pricing";

interface UsageBadgeProps {
  /** Domain à interroger (par défaut "chomage"). */
  domain?: string;
  /** Si fourni, déclenche un re-fetch quand la valeur change (ex: post-chat). */
  revalidateKey?: string | number;
  className?: string;
}

interface ByModelEntry {
  model: string;
  messages: number;
  input: number;
  output: number;
  usd: number;
  eur: number;
}

interface UsageResponse {
  domain: string;
  totalTokens: { input: number; output: number; all: number };
  totalCost: { usd: number; eur: number };
  byModel: ByModelEntry[];
  prompts: {
    count: number;
    estimatedOutputTokens: number;
    estimatedUsd: number;
    estimatedEur: number;
  };
  rate: { usdToEur: number };
  lastUpdated: string;
}

/**
 * Garde un nom de modèle court pour l'affichage : "Sonnet 4.5", "Haiku 4.5".
 */
function shortModelName(model: string): string {
  if (model.includes("sonnet-4-5")) return "Sonnet 4.5";
  if (model.includes("haiku-4-5")) return "Haiku 4.5";
  if (model.includes("sonnet")) return "Sonnet";
  if (model.includes("haiku")) return "Haiku";
  if (model.includes("opus")) return "Opus";
  return model;
}

export function UsageBadge({
  domain = "chomage",
  revalidateKey,
  className,
}: UsageBadgeProps) {
  const [data, setData] = React.useState<UsageResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [refreshing, setRefreshing] = React.useState(false);

  const fetchUsage = React.useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      else setRefreshing(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/chomage-ia/usage?domain=${encodeURIComponent(domain)}`,
          { cache: "no-store" }
        );
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const json = (await res.json()) as UsageResponse;
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur réseau");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [domain]
  );

  React.useEffect(() => {
    fetchUsage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [domain, revalidateKey]);

  if (loading) {
    return (
      <div
        className={cn(
          "inline-flex shrink-0 items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[11.5px] font-medium text-amber-700 dark:bg-amber-950/30 dark:text-amber-300",
          className
        )}
        aria-busy="true"
      >
        <Loader2 className="size-3 animate-spin" />
        <span className="hidden sm:inline">Crédit…</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <button
        type="button"
        onClick={() => fetchUsage()}
        className={cn(
          "inline-flex shrink-0 items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-[11.5px] font-medium text-muted-foreground hover:text-foreground",
          className
        )}
        title={error ?? "Erreur"}
      >
        <AlertCircle className="size-3" />
        <span className="hidden sm:inline">N/A</span>
      </button>
    );
  }

  const totalTokens = data.totalTokens.all;
  const eurStr = fmtCostEur(data.totalCost.eur);
  const usdStr = fmtCostUsd(data.totalCost.usd);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-amber-300/60 bg-gradient-to-br from-amber-50 to-amber-100/40 px-2.5 text-[12px] font-semibold text-amber-900 shadow-sm transition-all hover:shadow-md dark:border-amber-500/30 dark:from-amber-950/40 dark:to-amber-900/20 dark:text-amber-200",
            className
          )}
          title={`${fmtTokensCompact(totalTokens)} tokens · ${eurStr} (${usdStr})`}
          aria-label={`Crédit IA consommé : ${eurStr} (${fmtTokensCompact(totalTokens)} tokens)`}
        >
          <Coins className="size-3.5 shrink-0" />
          <span className="tabular-nums">≈ {eurStr}</span>
          <span className="hidden text-[10.5px] font-normal text-amber-700/70 dark:text-amber-300/70 md:inline">
            · {fmtTokensCompact(totalTokens)}tk
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        side="bottom"
        className="w-[min(340px,calc(100vw-1rem))] overflow-hidden p-0"
      >
        <UsageDetail data={data} onRefresh={() => fetchUsage(true)} refreshing={refreshing} />
      </PopoverContent>
    </Popover>
  );
}

function UsageDetail({
  data,
  onRefresh,
  refreshing,
}: {
  data: UsageResponse;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 border-b border-border px-4 py-3">
        <div>
          <div className="text-[13px] font-bold">Crédit IA — {data.domain}</div>
          <div className="text-[11px] text-muted-foreground">
            Estimation indicative (hors réductions éventuelles)
          </div>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
          title="Actualiser"
          aria-label="Actualiser"
        >
          <RefreshCw className={cn("size-3.5", refreshing && "animate-spin")} />
        </button>
      </div>

      {/* Totaux */}
      <div className="grid grid-cols-2 gap-px bg-border">
        <div className="bg-popover px-4 py-3">
          <div className="text-[10.5px] uppercase tracking-wide text-muted-foreground">
            Tokens totaux
          </div>
          <div className="mt-1 text-lg font-bold tabular-nums">
            {fmtTokensCompact(data.totalTokens.all)}
          </div>
          <div className="text-[11px] text-muted-foreground tabular-nums">
            {fmtTokensCompact(data.totalTokens.input)} in ·{" "}
            {fmtTokensCompact(data.totalTokens.output)} out
          </div>
        </div>
        <div className="bg-popover px-4 py-3">
          <div className="text-[10.5px] uppercase tracking-wide text-muted-foreground">
            Coût estimé
          </div>
          <div className="mt-1 text-lg font-bold tabular-nums text-amber-700 dark:text-amber-300">
            ≈ {fmtCostEur(data.totalCost.eur)}
          </div>
          <div className="text-[11px] text-muted-foreground tabular-nums">
            ({fmtCostUsd(data.totalCost.usd)} · taux {data.rate.usdToEur})
          </div>
        </div>
      </div>

      {/* By model */}
      {data.byModel.length > 0 ? (
        <div className="border-t border-border px-4 py-3">
          <div className="mb-2 text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">
            Chat par modèle
          </div>
          <ul className="flex flex-col gap-1.5">
            {data.byModel.map((row) => (
              <li
                key={row.model}
                className="flex items-center justify-between gap-3 text-[12px]"
              >
                <span className="flex items-center gap-2 truncate">
                  <span
                    className={cn(
                      "inline-block size-1.5 rounded-full",
                      row.model.includes("sonnet")
                        ? "bg-violet-500"
                        : "bg-sky-500"
                    )}
                  />
                  <span className="truncate font-medium">
                    {shortModelName(row.model)}
                  </span>
                  <span className="text-[10.5px] text-muted-foreground">
                    ({row.messages} msg)
                  </span>
                </span>
                <span className="flex items-baseline gap-2 tabular-nums">
                  <span className="text-[11px] text-muted-foreground">
                    {fmtTokensCompact(row.input + row.output)} tk
                  </span>
                  <span className="font-semibold text-amber-700 dark:text-amber-300">
                    ≈ {fmtCostEur(row.eur)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="border-t border-border px-4 py-3 text-[12px] text-muted-foreground">
          Aucun message chat persisté.
        </div>
      )}

      {/* Prompts */}
      <div className="border-t border-border px-4 py-3">
        <div className="mb-1 text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">
          Prompt-builder
        </div>
        {data.prompts.count > 0 ? (
          <div className="flex items-center justify-between text-[12px]">
            <span className="text-muted-foreground">
              {data.prompts.count} prompt
              {data.prompts.count > 1 ? "s" : ""} générés
            </span>
            <span className="flex items-baseline gap-2 tabular-nums">
              <span className="text-[11px] text-muted-foreground">
                ~{fmtTokensCompact(data.prompts.estimatedOutputTokens)} tk
              </span>
              <span className="font-semibold text-amber-700 dark:text-amber-300">
                ≈ {fmtCostEur(data.prompts.estimatedEur)}
              </span>
            </span>
          </div>
        ) : (
          <div className="text-[12px] text-muted-foreground">
            Aucun prompt généré.
          </div>
        )}
        <div className="mt-1 text-[10.5px] italic text-muted-foreground">
          Estimation : longueur de l&apos;output ÷ 4 (≈ 1 token / 4 chars).
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-border bg-muted/30 px-4 py-2 text-[10.5px] text-muted-foreground">
        Mis à jour : {new Date(data.lastUpdated).toLocaleTimeString("fr-BE")}
      </div>
    </div>
  );
}
