"use client";

// Stub temporaire — sera remplacé par l'agent en cours d'écriture.
// Garde le tsc vert pendant que le composant complet est livré.

import type { WizardSituation } from "@/lib/dossier-wizard/config";

interface Props {
  situations: WizardSituation[];
}

export function DossierWizard({ situations }: Props) {
  return (
    <div className="rounded-xl border border-dashed bg-muted/30 p-6 text-center text-sm text-muted-foreground">
      Wizard en cours de chargement…{" "}
      <span className="opacity-60">({situations.length} situations disponibles)</span>
    </div>
  );
}
