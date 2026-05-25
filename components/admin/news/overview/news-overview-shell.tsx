"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Newspaper, Plus, Tag, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { NewsOverviewStats } from "./news-overview-stats";
import { NewsOverviewFilters } from "./news-overview-filters";
import { NewsOverviewGrid } from "./news-overview-grid";
import type { NewsCounts, NewsItem, NewsStatusFilter } from "./types";

interface NewsListResponse {
  articles?: NewsItem[];
  total?: number;
  statusCounts?: Partial<Record<string, number>>;
}

const PAGE_LIMIT = 100;

/**
 * Orchestre l'état client de la page d'overview admin /admin/news.
 *
 * Refonte 2026-05 : remplace l'ancien `app/admin/news/page.tsx` (client tout
 * monolithe avec table + grille + bulk actions). On garde la donnée fetchée
 * client (l'API GET /api/news a déjà la pagination/recherche/tris côté serveur)
 * mais l'UI est éclatée en sous-composants compacts alignés sur le pattern
 * "overview" (méthodologies calculateurs, outils admin).
 *
 * Stratégie de fetch simplifiée :
 *   - Une seule requête à `/api/news?status=all&limit=100` (l'admin a la
 *     visibilité totale via `getCurrentUser().isAdmin`).
 *   - Filtrage statut + catégorie + recherche fait côté client (PAGE_LIMIT
 *     suffit largement pour le volume actuel ; la pagination URL est
 *     conservée si besoin futur).
 *   - Les `statusCounts` retournés par l'API sont utilisés pour les stats
 *     (chiffres globaux), pas dérivés des `articles` reçus.
 *
 * Features préservées :
 *   - Édition via click sur card → /admin/news/[id]
 *   - Suppression / Duplication via context menu (clic droit)
 *   - Bouton "Créer un article" en header
 *
 * Features non préservées dans cette refonte (cf. TODOs du rapport) :
 *   - Drag & drop pour réordonnancement (pas de champ `order` côté schema)
 *   - Bulk actions multi-sélection (publish/unpublish/delete en masse)
 *   - Export CSV (déplaçable dans une page dédiée si besoin)
 *   - Toggle "featured" inline (accessible via édition)
 *   - Vue table (uniquement vue grille de cards horizontales)
 */
export function NewsOverviewShell() {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [categoriesList, setCategoriesList] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshTick, setRefreshTick] = useState(0);

  const [status, setStatus] = useState<NewsStatusFilter>("all");
  const [category, setCategory] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Compteurs globaux retournés par l'API admin (groupBy status).
  const [serverCounts, setServerCounts] = useState<NewsCounts>({
    total: 0,
    published: 0,
    draft: 0,
    scheduled: 0,
    archived: 0,
  });

  const requestIdRef = useRef(0);

  // Debounce du champ recherche : évite de re-filtrer à chaque frappe.
  useEffect(() => {
    const handle = window.setTimeout(() => {
      setDebouncedSearch(search.trim().toLowerCase());
    }, 250);
    return () => window.clearTimeout(handle);
  }, [search]);

  // Fetch initial + après chaque mutation (delete / duplicate).
  useEffect(() => {
    let cancelled = false;
    const requestId = ++requestIdRef.current;
    setIsLoading(true);
    (async () => {
      try {
        const res = await fetch(
          `/api/news?status=all&sortBy=createdAt&sortOrder=desc&page=1&limit=${PAGE_LIMIT}`,
          { cache: "no-store" },
        );
        if (!res.ok) throw new Error("Failed");
        const data = (await res.json()) as NewsListResponse;
        if (cancelled || requestId !== requestIdRef.current) return;
        setItems(data.articles ?? []);
        const sc = data.statusCounts ?? {};
        setServerCounts({
          total: sc.all ?? data.total ?? 0,
          published: sc.published ?? 0,
          draft: sc.draft ?? 0,
          scheduled: sc.scheduled ?? 0,
          archived: sc.archived ?? 0,
        });
      } catch (err) {
        if (cancelled) return;
        console.error("Error fetching news:", err);
        toast.error("Erreur lors du chargement des articles");
      } finally {
        if (!cancelled && requestId === requestIdRef.current) {
          setIsLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshTick]);

  // Catégories distinctes — utilise la liste d'articles + endpoint /api/categories
  // pour avoir aussi les catégories sans article. Fail-silent si l'API échoue.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/categories", { cache: "no-store" });
        if (!res.ok) throw new Error("Failed");
        const data = (await res.json()) as Array<{ name: string }>;
        if (cancelled) return;
        setCategoriesList(data.map((c) => c.name).sort((a, b) => a.localeCompare(b)));
      } catch {
        if (cancelled) return;
        // Fallback : déduire les catégories des articles chargés.
        const set = new Set(items.map((i) => i.category).filter(Boolean));
        setCategoriesList(Array.from(set).sort((a, b) => a.localeCompare(b)));
      }
    })();
    return () => {
      cancelled = true;
    };
    // Volontairement dépendant de `items` pour réagir au cas où l'API
    // categories ne renvoie pas tout (fallback). Pas grave si re-déclenché.
  }, [items]);

  const counts: NewsCounts = serverCounts;

  /** Liste filtrée par tab + catégorie + recherche. */
  const filtered = useMemo(() => {
    return items.filter((item) => {
      if (status !== "all" && item.status !== status) return false;
      if (category !== "all" && item.category !== category) return false;
      if (!debouncedSearch) return true;
      return (
        item.title.toLowerCase().includes(debouncedSearch) ||
        item.excerpt.toLowerCase().includes(debouncedSearch) ||
        item.slug.toLowerCase().includes(debouncedSearch)
      );
    });
  }, [items, status, category, debouncedSearch]);

  const resetFilters = useCallback(() => {
    setStatus("all");
    setCategory("all");
    setSearch("");
  }, []);

  const onMutated = useCallback(() => {
    setRefreshTick((t) => t + 1);
  }, []);

  return (
    <div className="flex flex-col gap-5 px-4 py-6 lg:px-6">
      {/* En-tête ----------------------------------------------------- */}
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Newspaper className="size-5" />
          </span>
          <div className="flex flex-col">
            <h1 className="text-2xl font-bold leading-tight">
              Articles &amp; Actualités
            </h1>
            <p className="text-sm text-muted-foreground">
              {counts.total} article{counts.total > 1 ? "s" : ""} — gérez vos
              actualités, brouillons et planifications.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            render={<Link href="/admin/news/stats" prefetch={false} />}
            variant="outline"
            size="sm"
          >
            <BarChart3 className="size-4" />
            Statistiques
          </Button>
          <Button
            render={<Link href="/admin/news/categories" prefetch={false} />}
            variant="outline"
            size="sm"
          >
            <Tag className="size-4" />
            Catégories
          </Button>
          <Button
            render={<Link href="/admin/news/new" prefetch={false} />}
            size="sm"
          >
            <Plus className="size-4" />
            Créer un article
          </Button>
        </div>
      </header>

      {/* Stats + filtres + grille ---------------------------------- */}
      <NewsOverviewStats counts={counts} />
      <NewsOverviewFilters
        status={status}
        onStatusChange={setStatus}
        category={category}
        onCategoryChange={setCategory}
        categories={categoriesList}
        search={search}
        onSearchChange={setSearch}
        counts={counts}
      />
      <NewsOverviewGrid
        items={filtered}
        isLoading={isLoading}
        onResetFilters={resetFilters}
        onMutated={onMutated}
      />
    </div>
  );
}
