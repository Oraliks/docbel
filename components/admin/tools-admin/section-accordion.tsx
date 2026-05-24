"use client";

import { ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ToolCard } from "./tool-card";
import type { Section, Tool } from "./types";

interface Props {
  section: Section;
  tools: Tool[]; // outils filtrés (≠ section.tools complets)
  open: boolean;
  onToggle: () => void;
}

/**
 * Accordéon pour une section. Header cliquable (chevron + nom + compteurs),
 * body avec grid responsive (1 col mobile, 2 md, 3 xl) de ToolCard.
 *
 * Pour l'animation, on garde simple : `hidden` quand fermé (pas de
 * transition CSS, MVP). Les compteurs affichés tiennent compte des outils
 * *visibles après filtre* — l'utilisateur voit combien matchent
 * la recherche dans chaque section, pas le total absolu.
 */
export function SectionAccordion({ section, tools, open, onToggle }: Props) {
  const actifs = tools.filter((t) => t.active).length;
  const total = tools.length;

  return (
    <section className="rounded-xl border bg-card/50">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-accent/50"
      >
        <ChevronDown
          className={`size-4 shrink-0 text-muted-foreground transition-transform ${
            open ? "" : "-rotate-90"
          }`}
        />
        {section.icon ? (
          <span className="text-base leading-none">{section.icon}</span>
        ) : null}
        <h2 className="text-sm font-semibold">{section.name}</h2>
        <Badge variant="secondary" className="text-[10px]">
          {total === 1 ? "1 outil" : `${total} outils`}
        </Badge>
        <Badge
          variant="outline"
          className="text-[10px] text-emerald-700 dark:text-emerald-300"
        >
          {actifs} {actifs === 1 ? "actif" : "actifs"}
        </Badge>
        {section.description ? (
          <span className="hidden flex-1 truncate text-[11px] text-muted-foreground md:inline">
            — {section.description}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="px-4 pb-4 pt-1">
          {tools.length === 0 ? (
            <p className="rounded-lg border border-dashed py-6 text-center text-sm text-muted-foreground">
              Aucun outil ne correspond aux filtres dans cette section.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {tools.map((tool) => (
                <ToolCard key={tool.id} tool={tool} />
              ))}
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
