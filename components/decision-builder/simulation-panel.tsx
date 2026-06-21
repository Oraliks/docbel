"use client";

/// Onglet « Tester » : rend le VRAI wizard public (`DossierWizard`) en mode
/// `dryRun` via l'adapter `treeContentToWizardSituations`. L'admin voit donc
/// exactement ce que verra l'utilisateur (parité totale), sans analytics ni
/// navigation (les CTA de résultat sont neutralisés en dryRun).
///
/// Catalogue vide ici : on teste la STRUCTURE/le parcours. L'enrichissement
/// (documents, points, dossiers proches) est alimenté côté page publique.

import { useMemo } from "react";
import { Info } from "lucide-react";
import { DossierWizard } from "@/components/docbel/onboarding/dossier-wizard";
import { treeContentToWizardSituations } from "@/lib/decision-builder/adapter";
import type { DecisionTreeContent } from "@/lib/decision-builder/types";

export function SimulationPanel({ content }: { content: DecisionTreeContent }) {
  const situations = useMemo(
    () => treeContentToWizardSituations(content),
    [content],
  );

  // Signature de structure : force le remount du wizard quand l'arbre change
  // (évite un état interne périmé après édition).
  const sig = useMemo(
    () => `${content.rootNodeId ?? "none"}:${Object.keys(content.nodes).length}`,
    [content],
  );

  if (situations.length === 0) {
    return (
      <div className="mx-auto max-w-md p-8 text-center">
        <Info className="mx-auto size-6 text-muted-foreground" />
        <p className="mt-2 text-sm font-medium">Rien à tester pour l'instant</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Ajoutez une question racine et au moins une réponse dans l'onglet
          Arbre pour lancer la simulation.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-4 flex items-start gap-2 rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
        <Info className="mt-0.5 size-4 shrink-0" />
        <p>
          Aperçu fidèle du wizard public (mode test : aucun suivi, les boutons
          « Démarrer » sont désactivés). Le contenu enrichi des dossiers
          (documents, points d'attention) s'affichera sur la page publique.
        </p>
      </div>
      <div className="mx-auto max-w-2xl">
        <DossierWizard key={sig} situations={situations} catalog={{}} dryRun />
      </div>
    </div>
  );
}
