/**
 * Helpers partagés par la vue tabulaire des sources.
 *
 * Volontairement isolé du `_shared.tsx` module-wide pour éviter de polluer
 * les autres écrans (chat, prompt-builder).
 */

import type { KnowledgeSourceListItem } from "@/lib/chomage-ia/types";

/**
 * Format compact "K chars / M chars" pour la colonne taille.
 */
export function fmtContentLen(n: number): string {
  if (n < 1000) return `${n}`;
  if (n < 1_000_000) return `${(n / 1000).toFixed(1)}K`;
  return `${(n / 1_000_000).toFixed(1)}M`;
}

/**
 * Date compacte (ex: "12 mai", "il y a 3h").
 *
 * - < 1h    → "il y a Xmin"
 * - < 24h   → "il y a Xh"
 * - < 7j    → "il y a Xj"
 * - sinon   → "12 mai" (année si différente)
 */
export function fmtCompactDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    const diff = Date.now() - d.getTime();
    const min = Math.floor(diff / 60_000);
    if (min < 1) return "à l'instant";
    if (min < 60) return `${min}m`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h`;
    const day = Math.floor(hr / 24);
    if (day < 7) return `${day}j`;
    const sameYear = d.getFullYear() === new Date().getFullYear();
    return d.toLocaleDateString("fr-BE", {
      day: "2-digit",
      month: "short",
      year: sameYear ? undefined : "numeric",
    });
  } catch {
    return "—";
  }
}

/**
 * Statut d'indexation RAG dérivé. Mêmes règles que `source-card.tsx` historique
 * mais isolé ici pour ne pas créer de dépendance croisée.
 */
export type IndexStatus = "none" | "pending" | "ok" | "error";

export function deriveIndexStatus(
  item: KnowledgeSourceListItem
): IndexStatus {
  if (item.indexError) {
    if (
      item.indexedAt &&
      (item.indexError.includes("trop court") ||
        item.indexError.includes("trop courte") ||
        item.indexError.includes("Content vide") ||
        item.indexError.includes("rien à indexer"))
    ) {
      return "pending";
    }
    return "error";
  }
  if (item.indexedAt) return "ok";
  return "none";
}

/**
 * Catégories de statut utilisées pour le filtre toolbar.
 *
 * - "active" / "disabled" → champ `enabled`
 * - "extraction-failed"   → contentPreview suspect (placeholder ou très court)
 * - "not-indexed"         → indexedAt null + indexError indique pas ok
 */
export type StatusFilter =
  | "all"
  | "active"
  | "disabled"
  | "extraction-failed"
  | "not-indexed";

export function matchesStatusFilter(
  item: KnowledgeSourceListItem,
  filter: StatusFilter
): boolean {
  if (filter === "all") return true;
  if (filter === "active") return item.enabled;
  if (filter === "disabled") return !item.enabled;
  if (filter === "extraction-failed") {
    return (
      item.contentPreview.startsWith("(Contenu") ||
      item.contentPreview.includes("non extrait automatiquement")
    );
  }
  if (filter === "not-indexed") {
    return deriveIndexStatus(item) !== "ok";
  }
  return true;
}

/**
 * Tri stable des sources selon la colonne demandée.
 *
 * `localeCompare` pour `title` (avec sensitivity base pour ignorer la casse).
 * Numérique direct pour les autres.
 */
export type SortColumn = "title" | "kind" | "size" | "date";
export type SortDirection = "asc" | "desc";

export function sortSources(
  items: KnowledgeSourceListItem[],
  column: SortColumn,
  direction: SortDirection
): KnowledgeSourceListItem[] {
  const factor = direction === "asc" ? 1 : -1;
  const copy = items.slice();
  copy.sort((a, b) => {
    let cmp = 0;
    switch (column) {
      case "title":
        cmp = a.title.localeCompare(b.title, "fr", { sensitivity: "base" });
        break;
      case "kind":
        cmp = a.kind.localeCompare(b.kind);
        break;
      case "size":
        cmp = a.contentLength - b.contentLength;
        break;
      case "date":
        cmp =
          new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
        break;
    }
    return cmp * factor;
  });
  return copy;
}

/**
 * Liste unique des tags présents dans le snapshot courant des sources.
 * Sert au dropdown filtre + au bulk-tag-picker (suggestions).
 */
export function extractAllTags(items: KnowledgeSourceListItem[]): string[] {
  const set = new Set<string>();
  for (const it of items) {
    for (const t of it.tags) set.add(t);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, "fr"));
}

/* ------------------------------------------------------------------ */
/*  Migration 22 — Validity status (fresh / stale / obsolete)          */
/* ------------------------------------------------------------------ */

export type ValidityFilter =
  | "all"
  | "fresh"
  | "stale"
  | "obsolete"
  | "unknown";

const VALIDITY_LABELS: Record<
  KnowledgeSourceListItem["validityStatus"],
  { label: string; emoji: string; className: string }
> = {
  fresh: {
    label: "Fraîche",
    emoji: "🟢",
    className: "text-emerald-700 dark:text-emerald-400",
  },
  stale: {
    label: "À vérifier",
    emoji: "🟡",
    className: "text-amber-700 dark:text-amber-400",
  },
  obsolete: {
    label: "Périmée",
    emoji: "🔴",
    className: "text-red-700 dark:text-red-400",
  },
  unknown: {
    label: "Non scannée",
    emoji: "⚪",
    className: "text-muted-foreground",
  },
};

export function getValidityMeta(
  status: KnowledgeSourceListItem["validityStatus"],
): { label: string; emoji: string; className: string } {
  return VALIDITY_LABELS[status] ?? VALIDITY_LABELS.unknown;
}

export function matchesValidityFilter(
  item: KnowledgeSourceListItem,
  filter: ValidityFilter,
): boolean {
  if (filter === "all") return true;
  return item.validityStatus === filter;
}
