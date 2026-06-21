/// Dérivation des résultats du wizard d'orientation (PRÉ-GUIDE, pas un
/// simulateur). À partir du `WizardResult` d'une feuille de l'arbre et d'un
/// catalogue de bundles (chargé en DB), produit :
///   - un dossier PRINCIPAL enrichi (organisme, durée, documents à préparer,
///     points d'attention),
///   - une liste de dossiers PROCHES (issus de `result.related` ∪ du champ
///     `relatedBundles` du bundle principal).
///
/// Fonction PURE (aucune dépendance React/DB) → testable unitairement.

import type { WizardResult } from "./config";
import type { WarningLevel } from "@/lib/bundles/types";

export type MatchLevel = "recommande" | "pertinent" | "a_verifier";

/// Métadonnées d'un bundle nécessaires au wizard (sous-ensemble sérialisable
/// de DocumentBundle). `points` = titres d'avertissements.
export interface WizardBundleMeta {
  slug: string;
  name: string;
  organism: string | null;
  requiredDocuments: string[];
  points: string[];
  warningLevel: WarningLevel | null;
  estimatedTime: number | null;
  relatedBundles: string[];
  available: boolean;
}

export type WizardCatalog = Record<string, WizardBundleMeta>;

export type Availability = "disponible" | "a_creer" | "orientation_externe";

export interface DerivedDossier {
  /// `null` ⇒ « bientôt disponible » (pas de bundle publié).
  slug: string | null;
  title: string;
  rationale: string;
  matchLevel: MatchLevel;
  organism: string | null;
  requiredDocuments: string[];
  points: string[];
  estimatedTime: number | null;
  /// true si un parcours `/d/[slug]` peut être démarré.
  available: boolean;
  /// Disponibilité explicite (modèle ONEM 2026). Absent ⇒ déduit du slug.
  availability: Availability;
  /// Étape suivante non engageante (optionnelle).
  nextStep: string | null;
}

export interface DerivedResults {
  primary: DerivedDossier;
  related: DerivedDossier[];
}

const MAX_RELATED = 3;

function enrich(
  base: {
    slug: string | null;
    title: string;
    rationale: string;
    matchLevel: MatchLevel;
    availability?: Availability;
    nextStep?: string | null;
  },
  catalog: WizardCatalog,
): DerivedDossier {
  const meta = base.slug ? catalog[base.slug] : undefined;
  // `availability` explicite pilote le rendu ; sinon on déduit du slug
  // (rétro-compat avec les résultats sans availability).
  const availability: Availability =
    base.availability ?? (base.slug !== null ? "disponible" : "a_creer");
  return {
    slug: base.slug,
    title: base.title,
    rationale: base.rationale,
    matchLevel: base.matchLevel,
    organism: meta?.organism ?? null,
    requiredDocuments: meta?.requiredDocuments ?? [],
    points: meta?.points ?? [],
    estimatedTime: meta?.estimatedTime ?? null,
    // Démarrable seulement si "disponible" ET bundle réellement présent.
    available: availability === "disponible" && base.slug !== null,
    availability,
    nextStep: base.nextStep ?? null,
  };
}

export function deriveWizardResults(
  result: WizardResult,
  catalog: WizardCatalog = {},
): DerivedResults {
  const primary = enrich(
    {
      slug: result.dossierSlug,
      title: result.dossierTitle,
      rationale: result.rationale,
      matchLevel: result.matchLevel ?? "recommande",
      availability: result.availability,
      nextStep: result.nextStep,
    },
    catalog,
  );

  // Slugs proches : ceux de la config + ceux du bundle principal, dédupliqués,
  // sans le principal, et seulement ceux résolubles dans le catalogue.
  const fromConfig = result.related ?? [];
  const fromBundle = result.dossierSlug
    ? catalog[result.dossierSlug]?.relatedBundles ?? []
    : [];
  const seen = new Set<string>();
  if (result.dossierSlug) seen.add(result.dossierSlug);

  const related: DerivedDossier[] = [];
  for (const slug of [...fromConfig, ...fromBundle]) {
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    const meta = catalog[slug];
    if (!meta) continue; // pas de carte sans titre lisible
    related.push(
      enrich(
        {
          slug: meta.slug,
          title: meta.name,
          rationale: "",
          matchLevel: "pertinent",
        },
        catalog,
      ),
    );
    if (related.length >= MAX_RELATED) break;
  }

  return { primary, related };
}
