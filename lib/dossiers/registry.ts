// Registre des dossiers "codés".
//
// Un dossier dont le slug est présent ici est piloté par son module de code
// (questions, sélection de documents, logique). Les dossiers absents du
// registre restent pilotés par la config DB (DocumentBundle éditable en admin).
//
// Ajouter un dossier = créer son module sous lib/dossiers/<slug>/ et
// l'enregistrer ici. Aucun impact sur les dossiers existants.

import type { DossierDefinition } from "./types";
import { chomageTemporaire } from "./chomage-temporaire";
import { chomageComplet } from "./chomage-complet";
import { chomageFrontalier } from "./chomage-frontalier";
import { prepension } from "./prepension";

const REGISTRY: Record<string, DossierDefinition> = {
  [chomageTemporaire.slug]: chomageTemporaire,
  [chomageComplet.slug]: chomageComplet,
  [chomageFrontalier.slug]: chomageFrontalier,
  [prepension.slug]: prepension,
};

/// Renvoie la définition de dossier codée pour ce slug, ou null si le dossier
/// est piloté par la config DB.
export function getDossier(slug: string): DossierDefinition | null {
  return REGISTRY[slug] ?? null;
}

/// true si le dossier est piloté par du code (et non par la config DB).
export function isCodeDossier(slug: string): boolean {
  return slug in REGISTRY;
}

/// Liste tous les dossiers codés (pour l'admin / le seed).
export function listDossiers(): DossierDefinition[] {
  return Object.values(REGISTRY);
}
