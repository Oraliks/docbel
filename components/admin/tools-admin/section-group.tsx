"use client";

import { ToolCard } from "./tool-card";
import type { Section, Tool } from "./types";

interface SectionGroupProps {
  section: Section;
  tools: Tool[]; // outils filtrés (≠ section.tools complets)
}

/**
 * Affiche une section d'outils — header simple (titre + compteur) suivi
 * d'une grille de `ToolCard` 2 colonnes sur desktop, 1 sur mobile.
 *
 * Remplace l'ancien `SectionAccordion` (toujours collapsable) par un
 * groupe plat : la refonte privilégie la lecture immédiate vu qu'il y a
 * peu de sections (3 actuellement) et une trentaine d'outils max.
 *
 * Quand la section ne contient aucun outil filtré, on ne rend rien — le
 * shell (`workspace.tsx`) filtre déjà les sections vides en amont, mais
 * on garde un garde-fou local en cas d'évolution.
 */
export function SectionGroup({ section, tools }: SectionGroupProps) {
  if (tools.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      {/* Header : nom + compteurs ------------------------------------ */}
      <header className="flex items-center gap-2 border-b border-border/60 pb-2">
        {section.icon ? (
          <span className="text-base leading-none" aria-hidden="true">
            {section.icon}
          </span>
        ) : null}
        <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground">
          {section.name}
        </h2>
        <span className="text-[11.5px] font-medium text-muted-foreground">
          ({tools.length})
        </span>
        {section.description ? (
          <span className="hidden truncate text-[11.5px] text-muted-foreground sm:inline">
            — {section.description}
          </span>
        ) : null}
      </header>

      {/* Grille d'outils ---------------------------------------------- */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {tools.map((tool) => (
          <ToolCard key={tool.id} tool={tool} />
        ))}
      </div>
    </section>
  );
}
