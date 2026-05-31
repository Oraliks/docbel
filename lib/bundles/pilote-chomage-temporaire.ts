/// Entrée historique du seed "Chômage temporaire".
///
/// Le contenu (questions, documents, motifs, avertissements) vit désormais
/// dans le MODULE de dossier `lib/dossiers/chomage-temporaire` — source unique.
/// Ce fichier ne fait que déléguer au seed générique, en conservant le nom
/// d'export utilisé par la route admin existante.

import { chomageTemporaire } from "@/lib/dossiers/chomage-temporaire";
import { seedDossier, type SeedResult } from "@/lib/dossiers/seed";

export type PiloteResult = SeedResult;

export async function createOrUpdatePiloteChomageTemporaire(userId: string | null): Promise<PiloteResult> {
  return seedDossier(chomageTemporaire, userId);
}
