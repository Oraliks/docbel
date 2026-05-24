import { SearchX } from "lucide-react";
import type { CalcMethodology } from "@/lib/calculators/_methodology";
import { OverviewCard } from "./overview-card";

interface OverviewGridProps {
  methodologies: CalcMethodology[];
  onResetFilters: () => void;
}

/**
 * Grille 2 colonnes de cards de méthodologies filtrées.
 *
 * Si la liste est vide (après application de filtres), affiche un état
 * vide centré avec un bouton "Réinitialiser les filtres".
 */
export function OverviewGrid({
  methodologies,
  onResetFilters,
}: OverviewGridProps) {
  if (methodologies.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-card/40 px-4 py-10 text-center">
        <div className="flex size-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
          <SearchX className="size-5" />
        </div>
        <p className="text-sm text-muted-foreground">
          Aucun calculateur ne correspond à ces critères.
        </p>
        <button
          type="button"
          onClick={onResetFilters}
          className="text-[12.5px] font-semibold text-primary underline-offset-2 hover:underline"
        >
          Réinitialiser les filtres
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      {methodologies.map((m) => (
        <OverviewCard key={m.slug} data={m} />
      ))}
    </div>
  );
}
