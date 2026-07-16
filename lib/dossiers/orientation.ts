/// Réponses du wizard d'orientation de /mon-dossier, transmises au dossier
/// via le cookie `beldoc-orientation` (posé par
/// components/docbel/onboarding/dossier-wizard.tsx, TTL 10 min, consommé
/// définitivement au démarrage ou à la mise à jour du BundleRun).
///
/// Module PUR (zéro dépendance) : parse et aplatit le cookie pour les
/// mappers `prefillFromOrientation` des dossiers codés. La forme brute est
/// `{ situation: {value}, subOption: {value}, refine: {value}, slug: {value} }`
/// — les ids correspondent aux `value` de lib/dossier-wizard/config.ts (et de
/// l'arbre Decision Builder publié, parité garantie par seed-parity.test.ts).

export interface OrientationAnswers {
  /// Situation choisie à l'étape 1 (ex. "jeune-etudes", "perte-emploi").
  situation?: string;
  /// Sous-option de l'étape 2 (ex. "sors-etudes", "25-plus").
  subOption?: string;
  /// Affinage de l'étape 3 (ex. "premiere", "redemande").
  refine?: string;
  /// Slug du dossier vers lequel le wizard a résolu.
  slug?: string;
}

/// Parse la valeur BRUTE du cookie d'orientation (percent-encodée par le
/// wizard, ou déjà décodée) ainsi que le JSON déjà stocké sur BundleRun.
/// Tolérant : toute forme inattendue → null (le préremplissage est un bonus,
/// jamais un besoin).
export function parseOrientationAnswers(raw: unknown): OrientationAnswers | null {
  let parsed: unknown;
  if (typeof raw === "string") {
    if (raw.length === 0) return null;
    try {
      let text = raw;
      try {
        text = decodeURIComponent(raw);
      } catch {
        // Valeur déjà décodée (ou % isolé) — on tente le parse tel quel.
      }
      parsed = JSON.parse(text);
    } catch {
      return null;
    }
  } else {
    parsed = raw;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;

  const out: OrientationAnswers = {};
  const src = parsed as Record<string, unknown>;
  for (const key of ["situation", "subOption", "refine", "slug"] as const) {
    const entry = src[key];
    if (entry && typeof entry === "object" && !Array.isArray(entry)) {
      const value = (entry as Record<string, unknown>).value;
      if (typeof value === "string" && value.length > 0) out[key] = value;
    } else if (typeof entry === "string" && entry.length > 0) {
      // Tolère aussi la forme déjà aplatie (BundleRun.orientationAnswers).
      out[key] = entry;
    }
  }
  return Object.keys(out).length > 0 ? out : null;
}

const C1_CHANGE_FIELD_BY_ORIENTATION = {
  "situation-familiale-assistant": "modificationSituationFamiliale",
  adresse: "modificationAdresse",
  "situation-personnelle-menage": "modificationSituationFamiliale",
  "permis-sejour-travail": "modificationPermisSejour",
  "compte-bancaire": "modificationCompte",
  "organisme-paiement": "transfereOrganismePaiement",
} as const;

/**
 * Convertit le choix principal de l'assistant « changement de situation » en
 * valeur initiale du C1. Les ids du Decision Builder portent un préfixe
 * (`opt_changement-situation-personnelle_...`) alors que l'ancien wizard
 * stockait directement la valeur courte : les deux formes sont acceptées.
 */
export function orientationAnswersToC1Prefill(
  raw: unknown,
): Record<string, boolean> {
  const orientation = parseOrientationAnswers(raw);
  if (
    !orientation ||
    orientation.slug !== "changement-situation-personnelle" ||
    !orientation.subOption
  ) {
    return {};
  }

  const selected = orientation.subOption;
  for (const [option, fieldId] of Object.entries(C1_CHANGE_FIELD_BY_ORIENTATION)) {
    if (selected === option || selected.endsWith(`_${option}`)) {
      return { [fieldId]: true };
    }
  }
  return {};
}
