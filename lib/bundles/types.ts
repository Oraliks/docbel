/// Types partagés pour les extensions onboarding du modèle DocumentBundle.
///
/// Ces types correspondent aux champs JSON ajoutés par la migration 12 :
/// - `warnings` : avertissements importants affichés en haut du parcours
/// - Les autres types (`EligibilityQuestion`, vocabulaire, conditions) sont
///   définis dans leurs modules respectifs.

// ---------------------------------------------------------------------------
// Catégories d'événements de vie pré-définies (libre, mais on suggère ces 8)
// ---------------------------------------------------------------------------

export const LIFE_EVENT_CATEGORIES = [
  { id: "emploi", label: "Emploi & chômage", emoji: "💼" },
  { id: "formation", label: "Formation & études", emoji: "🎓" },
  { id: "famille", label: "Famille", emoji: "👨‍👩‍👧" },
  { id: "logement", label: "Logement", emoji: "🏠" },
  { id: "sante", label: "Santé & invalidité", emoji: "🏥" },
  { id: "pension", label: "Pension & aînés", emoji: "👴" },
  { id: "social", label: "Aide sociale", emoji: "🤝" },
  { id: "independant", label: "Indépendant", emoji: "🧑‍💼" },
] as const;

export type LifeEventCategoryId = (typeof LIFE_EVENT_CATEGORIES)[number]["id"];

export function getLifeEventCategory(id: string | null | undefined) {
  if (!id) return null;
  return LIFE_EVENT_CATEGORIES.find((c) => c.id === id) ?? null;
}

// ---------------------------------------------------------------------------
// Avertissements (warnings) affichés en tête de parcours
// ---------------------------------------------------------------------------

export type WarningSeverity = "info" | "warning" | "critical";

export interface BundleWarning {
  id: string;
  /// Titre court (ex. "Délai critique — carte EC32")
  title: string;
  /// Message complet en langage simple (peut contenir du markdown léger)
  message: string;
  severity: WarningSeverity;
  /// Lien éventuel vers la source officielle ou un guide
  helpUrl?: string;
}

// ---------------------------------------------------------------------------
// Validation à l'entrée (sécurise les données JSON venant de la base)
// ---------------------------------------------------------------------------

export function parseBundleWarnings(input: unknown): BundleWarning[] {
  if (!Array.isArray(input)) return [];
  const out: BundleWarning[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    if (typeof r.id !== "string" || typeof r.title !== "string" || typeof r.message !== "string") {
      continue;
    }
    out.push({
      id: r.id,
      title: r.title,
      message: r.message,
      severity: parseSeverity(r.severity),
      helpUrl: typeof r.helpUrl === "string" ? r.helpUrl : undefined,
    });
  }
  return out;
}

function parseSeverity(v: unknown): WarningSeverity {
  if (v === "info" || v === "warning" || v === "critical") return v;
  return "info";
}
