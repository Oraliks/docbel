"use client";

import { useMemo, useState } from "react";
import { Wrench } from "lucide-react";
import { effectiveRules } from "@/lib/entitlements";
import { StatsCards } from "./stats-cards";
import { FiltersBar } from "./filters-bar";
import { ToolsTable } from "./tools-table";
import { typeLabel } from "./shared";
import type { FlatTool, Section, StatusFilter, ToolCounts } from "./types";

interface Props {
  sections: Section[];
}

/**
 * Page admin /outils — refonte "datagrid" (mockup 2026-06).
 *
 * On aplatit les sections en une seule liste d'outils (la section devient la
 * colonne "Catégorie") et on rend une table dense unique au lieu d'une grille
 * de cards par section. Les filtres (recherche / catégorie / type / audience /
 * statut) sont orchestrés ici puis la liste filtrée est passée à `ToolsTable`,
 * qui gère tri, sélection, actions groupées et pagination.
 */
export function ToolsAdminWorkspace({ sections }: Props) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [type, setType] = useState<string>("all");
  const [audience, setAudience] = useState<string>("all");
  const [status, setStatus] = useState<StatusFilter>("all");

  // Aplatissement : section.order puis tool.order → ordre stable par défaut.
  const flat = useMemo<FlatTool[]>(() => {
    return [...sections]
      .sort((a, b) => a.order - b.order)
      .flatMap((s) =>
        [...s.tools]
          .sort((a, b) => a.order - b.order)
          .map((t) => ({ ...t, sectionId: s.id, sectionName: s.name })),
      );
  }, [sections]);

  /** Compteurs globaux + par segment — toujours sur la liste TOTALE. */
  const counts = useMemo<ToolCounts>(() => {
    const c: ToolCounts = {
      total: flat.length,
      active: 0,
      inactive: 0,
      popular: 0,
      citoyen: 0,
      employeur: 0,
      partenaire: 0,
    };
    for (const t of flat) {
      if (t.active) c.active++;
      else c.inactive++;
      if (t.popular) c.popular++;
      const segments = new Set(effectiveRules(t).map((r) => r.segment));
      if (segments.has("citoyen")) c.citoyen++;
      if (segments.has("employeur")) c.employeur++;
      if (segments.has("partenaire")) c.partenaire++;
    }
    return c;
  }, [flat]);

  /** Libellés de type distincts présents (pour le select Type). */
  const typeOptions = useMemo(() => {
    const set = new Set(flat.map((t) => typeLabel(t.type)));
    return [...set].sort((a, b) => a.localeCompare(b, "fr"));
  }, [flat]);

  /** Liste filtrée passée à la table. */
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return flat.filter((t) => {
      if (status === "active" && !t.active) return false;
      if (status === "inactive" && t.active) return false;
      if (status === "popular" && !t.popular) return false;
      if (category !== "all" && t.sectionId !== category) return false;
      if (type !== "all" && typeLabel(t.type) !== type) return false;
      if (audience !== "all") {
        const segments = effectiveRules(t).map((r) => r.segment);
        if (!segments.includes(audience as never)) return false;
      }
      if (q) {
        return (
          t.name.toLowerCase().includes(q) ||
          t.slug.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [flat, search, category, type, audience, status]);

  return (
    <div className="flex flex-col gap-4">
      {/* En-tête ------------------------------------------------------- */}
      <header className="flex items-center gap-3">
        <span className="flex size-11 items-center justify-center rounded-2xl bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-200">
          <Wrench className="size-5" />
        </span>
        <div className="flex flex-col">
          <h1 className="text-2xl font-bold leading-tight">
            Catalogue des outils
          </h1>
          <p className="text-sm text-muted-foreground">
            Gérez et configurez tous les outils disponibles dans le catalogue
            public.
          </p>
        </div>
      </header>

      {/* Stats --------------------------------------------------------- */}
      <StatsCards counts={counts} />

      {/* Filtres ------------------------------------------------------- */}
      <FiltersBar
        search={search}
        onSearchChange={setSearch}
        category={category}
        onCategoryChange={setCategory}
        type={type}
        onTypeChange={setType}
        audience={audience}
        onAudienceChange={setAudience}
        status={status}
        onStatusChange={setStatus}
        sections={sections}
        typeOptions={typeOptions}
      />

      {/* Table --------------------------------------------------------- */}
      <ToolsTable tools={filtered} />
    </div>
  );
}
