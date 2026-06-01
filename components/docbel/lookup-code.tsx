"use client";

/**
 * <LookupCode/> — annote un code ONEM inline avec son libellé au survol.
 *
 * Pensé pour être posé ponctuellement dans les calculateurs / dossiers, là où
 * un code officiel (table signalétique, article, motif…) apparaît et mérite une
 * explication discrète sans casser la lecture.
 *
 * Le composant affiche `children` (ou le code brut à défaut) souligné en
 * pointillé. Au PREMIER survol seulement, il va chercher le libellé :
 *   - si `tableSlug` est fourni → GET /api/lookup/resolve (résolution exacte) ;
 *   - sinon → GET /api/lookup/search?limit=1 (meilleur résultat transverse).
 * Le résultat est mémorisé (cache module-level) pour ne jamais refetch le même
 * couple (tableSlug, code).
 *
 * ⚠️ Pas d'auto-hydratation de prose : les codes type "153,1" sont trop ambigus
 * pour être détectés automatiquement dans du texte. Usage EXPLICITE uniquement.
 *
 * @example
 * <LookupCode code="153,1" tableSlug="signaletic-sanction-article" />
 *
 * @example
 * // Sans tableSlug → recherche transverse (meilleur match)
 * <LookupCode code="C4">le formulaire C4</LookupCode>
 */

import * as React from "react";

import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { cn } from "@/lib/utils";

/** Données minimales affichées dans la carte de survol. */
interface ResolvedCode {
  code: string;
  labelFr: string;
  /** Libellé de la table d'origine (ex: "Article de sanction"). */
  tableLabelFr?: string;
}

/**
 * État de chargement d'un code :
 *   - "loading"  : fetch en cours
 *   - "missing"  : 404 / aucun résultat
 *   - "error"    : échec réseau (traité comme introuvable côté UI)
 *   - ResolvedCode : libellé trouvé
 */
type LookupState = ResolvedCode | "loading" | "missing" | "error";

// Cache module-level : une seule requête par couple (tableSlug, code) pour
// toute la durée de vie de la page. On stocke la Promise pour dédupliquer les
// fetchs concurrents (plusieurs <LookupCode/> identiques ouverts en rafale).
const cache = new Map<string, Promise<ResolvedCode | null>>();

function cacheKey(code: string, tableSlug?: string): string {
  return `${tableSlug ?? "*"}::${code}`;
}

/** Lance (ou réutilise) la résolution d'un code. */
function fetchCode(
  code: string,
  tableSlug?: string
): Promise<ResolvedCode | null> {
  const key = cacheKey(code, tableSlug);
  const cached = cache.get(key);
  if (cached) return cached;

  const promise = tableSlug
    ? resolveExact(code, tableSlug)
    : searchTopHit(code);

  // On met en cache la Promise immédiatement (dédup), mais on l'efface en cas
  // d'échec réseau pour autoriser une nouvelle tentative au prochain survol.
  promise.catch(() => cache.delete(key));
  cache.set(key, promise);
  return promise;
}

/** Résolution exacte via /api/lookup/resolve (404 → null). */
async function resolveExact(
  code: string,
  tableSlug: string
): Promise<ResolvedCode | null> {
  const params = new URLSearchParams({ tableSlug, code });
  const res = await fetch(`/api/lookup/resolve?${params.toString()}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`resolve ${res.status}`);
  const data: unknown = await res.json();
  const entry = (data as { entry?: unknown }).entry;
  if (!entry || typeof entry !== "object") return null;
  const e = entry as Record<string, unknown>;
  return {
    code: typeof e.code === "string" ? e.code : code,
    labelFr: typeof e.labelFr === "string" ? e.labelFr : "",
    tableLabelFr:
      typeof e.tableLabelFr === "string" ? e.tableLabelFr : undefined,
  };
}

/** Meilleur résultat transverse via /api/lookup/search?limit=1. */
async function searchTopHit(code: string): Promise<ResolvedCode | null> {
  const params = new URLSearchParams({ q: code, limit: "1" });
  const res = await fetch(`/api/lookup/search?${params.toString()}`);
  if (!res.ok) throw new Error(`search ${res.status}`);
  const data: unknown = await res.json();
  const results = (data as { results?: unknown }).results;
  if (!Array.isArray(results) || results.length === 0) return null;
  const top = results[0] as Record<string, unknown>;
  const table = top.table as Record<string, unknown> | undefined;
  return {
    code: typeof top.code === "string" ? top.code : code,
    labelFr: typeof top.labelFr === "string" ? top.labelFr : "",
    tableLabelFr:
      table && typeof table.labelFr === "string" ? table.labelFr : undefined,
  };
}

export interface LookupCodeProps {
  /** Le code ONEM à résoudre (ex: "153,1", "44", "C4"). */
  code: string;
  /**
   * Slug de la table pour une résolution exacte. Si absent, on retombe sur la
   * recherche transverse (meilleur match) — moins précis pour un code ambigu.
   */
  tableSlug?: string;
  /** Texte affiché à la place du code brut (ex: "le formulaire C4"). */
  children?: React.ReactNode;
  className?: string;
}

export function LookupCode({
  code,
  tableSlug,
  children,
  className,
}: LookupCodeProps) {
  const [state, setState] = React.useState<LookupState | null>(null);

  // Lazy-fetch déclenché à la première ouverture de la carte uniquement.
  const handleOpenChange = React.useCallback(
    (open: boolean) => {
      if (!open || state !== null) return;
      setState("loading");
      fetchCode(code, tableSlug)
        .then((resolved) => setState(resolved ?? "missing"))
        .catch(() => setState("error"));
    },
    [code, tableSlug, state]
  );

  const display = children ?? code;

  return (
    <HoverCard onOpenChange={handleOpenChange}>
      <HoverCardTrigger
        render={
          <span
            className={cn(
              "cursor-help underline decoration-dotted decoration-muted-foreground/60 underline-offset-2",
              className
            )}
          >
            {display}
          </span>
        }
      />
      <HoverCardContent className="w-64">
        <LookupCardBody code={code} state={state} />
      </HoverCardContent>
    </HoverCard>
  );
}

/** Corps de la carte de survol selon l'état de chargement. */
function LookupCardBody({
  code,
  state,
}: {
  code: string;
  state: LookupState | null;
}) {
  // null (pas encore ouvert) ou "loading" → indicateur de chargement.
  if (state === null || state === "loading") {
    return <p className="text-sm text-muted-foreground">Chargement…</p>;
  }

  if (state === "missing" || state === "error") {
    return (
      <div className="space-y-1">
        <p className="font-mono text-sm text-foreground">{code}</p>
        <p className="text-xs text-muted-foreground">Code introuvable</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <p className="font-mono text-xs text-muted-foreground">{state.code}</p>
      {state.labelFr ? (
        <p className="text-sm font-semibold text-foreground">{state.labelFr}</p>
      ) : (
        <p className="text-xs text-muted-foreground">Sans libellé</p>
      )}
      {state.tableLabelFr ? (
        <p className="text-xs text-muted-foreground">{state.tableLabelFr}</p>
      ) : null}
    </div>
  );
}
