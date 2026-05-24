"use client";

import { useMemo, useState } from "react";
import { Wrench } from "lucide-react";
import { StatsCards } from "./stats-cards";
import { FiltersBar } from "./filters-bar";
import { SectionAccordion } from "./section-accordion";
import type { Section, SortKey, StatusFilter, Tool } from "./types";

interface Props {
  sections: Section[];
}

/**
 * Page d'admin /outils refondue. Orchestre l'état des filtres (recherche
 * texte, catégorie, statut, tri) et rend :
 *   - en-tête (icône + titre + sous-titre)
 *   - 4 stats cards (calculées sur la totalité, pas sur le filtre)
 *   - barre de filtres
 *   - liste d'accordéons par section
 *
 * Les filtres sont entièrement client-side : aucun fetch supplémentaire.
 * Les ToolCard, eux, font leurs propres PATCH /api/tools/:slug et déclenchent
 * un `router.refresh()` après chaque modif pour resync les sections.
 */
export function ToolsAdminWorkspace({ sections }: Props) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<SortKey>("category");
  const [openSections, setOpenSections] = useState<Set<string>>(
    () => new Set(sections.map((s) => s.id)),
  );

  function toggleSection(id: string) {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  /**
   * Calcule la liste des sections à afficher après application des filtres.
   * - search : matche `name`, `slug`, `description` (case-insensitive)
   * - category : ne garde que la section dont l'id matche (ou toutes)
   * - status : ne garde que les outils active/inactive selon le choix
   * - sort : trie les outils à l'intérieur de chaque section
   *
   * Quand le résultat d'une section est vide *à cause du filtre*, on
   * masque la section entière (la card vide n'a pas de sens si la cause
   * est un filtre — différent du cas "0 outil en DB" qui resterait visible
   * mais ici n'arrive jamais : toutes les sections ont au moins 1 outil).
   */
  const filteredSections = useMemo(() => {
    const q = search.trim().toLowerCase();

    function matches(tool: Tool): boolean {
      if (status === "active" && !tool.active) return false;
      if (status === "inactive" && tool.active) return false;
      if (!q) return true;
      return (
        tool.name.toLowerCase().includes(q) ||
        tool.slug.toLowerCase().includes(q) ||
        tool.description.toLowerCase().includes(q)
      );
    }

    function sortTools(tools: Tool[]): Tool[] {
      const copy = [...tools];
      switch (sort) {
        case "name":
          return copy.sort((a, b) => a.name.localeCompare(b.name, "fr"));
        case "recent":
          // Pas de timestamp côté Tool : on retombe sur `order` décroissant
          // (les plus récents ajoutés ont en général l'order le plus grand).
          return copy.sort((a, b) => b.order - a.order);
        case "category":
        default:
          return copy.sort((a, b) => a.order - b.order);
      }
    }

    return sections
      .filter((s) => category === "all" || s.id === category)
      .map((s) => ({ ...s, tools: sortTools(s.tools.filter(matches)) }))
      .filter((s) => s.tools.length > 0);
  }, [sections, search, category, status, sort]);

  const hasResults = filteredSections.length > 0;

  return (
    <div className="flex flex-col gap-6">
      {/* En-tête : titre + sous-titre */}
      <header className="flex items-center gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-200">
          <Wrench className="size-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold leading-tight">Outils</h1>
          <p className="text-xs text-muted-foreground">
            Active ou désactive chaque outil. Désactivé = caché du catalogue
            public.
          </p>
        </div>
      </header>

      {/* Stats */}
      <StatsCards sections={sections} />

      {/* Filtres */}
      <FiltersBar
        search={search}
        onSearchChange={setSearch}
        category={category}
        onCategoryChange={setCategory}
        status={status}
        onStatusChange={setStatus}
        sort={sort}
        onSortChange={setSort}
        sections={sections}
      />

      {/* Liste des sections (accordéons) */}
      {hasResults ? (
        <div className="flex flex-col gap-4">
          {filteredSections.map((s) => (
            <SectionAccordion
              key={s.id}
              section={s}
              tools={s.tools}
              open={openSections.has(s.id)}
              onToggle={() => toggleSection(s.id)}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed py-12 text-center">
          <p className="text-sm text-muted-foreground">
            Aucun outil ne correspond aux filtres.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setCategory("all");
              setStatus("all");
            }}
            className="mt-2 text-xs text-primary underline-offset-2 hover:underline"
          >
            Réinitialiser les filtres
          </button>
        </div>
      )}
    </div>
  );
}
