/// Types d'événements analytiques internes de /mon-dossier.
/// Module PARTAGÉ (client + serveur) — pas de `server-only` ici : la liste
/// blanche sert aussi à la validation côté endpoint et à l'émission client.

export const BUNDLE_EVENT_TYPES = [
  "search_performed",
  "search_no_result",
  "wizard_started",
  "wizard_step_completed",
  "wizard_abandoned",
  /// Résultat affiché à l'utilisateur (metadata: slug, availability). Sert à
  /// mesurer la « demande orpheline » (résultats a_creer/externe atteints).
  "wizard_result_shown",
  "bundle_opened",
  "run_created",
  /// L'usager a récupéré ses documents complétés (zip ou email). Posé
  /// UNIQUEMENT côté serveur (routes download-all / email) — étape finale du
  /// funnel « Parcours ». Non émissible depuis le navigateur.
  "documents_downloaded",
  "resume_success",
  "resume_failed",
] as const;

export type BundleEventType = (typeof BUNDLE_EVENT_TYPES)[number];

export function isBundleEventType(v: unknown): v is BundleEventType {
  return (
    typeof v === "string" &&
    (BUNDLE_EVENT_TYPES as readonly string[]).includes(v)
  );
}

/// Événements émissibles depuis le navigateur (les autres ne sont posés que
/// côté serveur : run_created, resume_success, resume_failed).
export const CLIENT_BUNDLE_EVENTS: readonly BundleEventType[] = [
  "search_performed",
  "search_no_result",
  "wizard_started",
  "wizard_step_completed",
  "wizard_abandoned",
  "wizard_result_shown",
  "bundle_opened",
];

export function isClientBundleEvent(v: unknown): v is BundleEventType {
  return (
    isBundleEventType(v) &&
    (CLIENT_BUNDLE_EVENTS as readonly string[]).includes(v)
  );
}
