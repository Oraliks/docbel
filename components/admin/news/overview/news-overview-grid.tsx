"use client";

import { useTranslations } from "next-intl";
import { SearchX } from "lucide-react";
import { NewsOverviewCard } from "./news-overview-card";
import type { NewsItem } from "./types";

interface NewsOverviewGridProps {
  items: NewsItem[];
  isLoading: boolean;
  onResetFilters: () => void;
  onMutated: () => void;
}

/**
 * Grille 2 colonnes de cards d'articles filtrés.
 *
 * États possibles :
 *   - Loading : skeleton 4 placeholders
 *   - Vide (post-fetch) avec filtres actifs : message + bouton reset
 *   - Vide (post-fetch) sans filtres : message simple "aucun article"
 *   - Rempli : grille 2 col desktop, 1 col mobile
 */
export function NewsOverviewGrid({
  items,
  isLoading,
  onResetFilters,
  onMutated,
}: NewsOverviewGridProps) {
  const t = useTranslations("admin.news");
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-[64px] animate-pulse rounded-xl border border-border bg-card/40"
          />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-card/40 px-4 py-10 text-center">
        <div className="flex size-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
          <SearchX className="size-5" />
        </div>
        <p className="text-sm text-muted-foreground">
          {t("emptyNoMatch")}
        </p>
        <button
          type="button"
          onClick={onResetFilters}
          className="text-[12.5px] font-semibold text-primary underline-offset-2 hover:underline"
        >
          {t("resetFilters")}
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      {items.map((item) => (
        <NewsOverviewCard key={item.id} item={item} onMutated={onMutated} />
      ))}
    </div>
  );
}
