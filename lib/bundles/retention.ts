/// Politique de rétention RGPD des BundleRun (migration 53).
///
/// Trois états dans le cycle de vie d'un run :
///   1. soft-delete   : `status = "abandoned"` (posé par DELETE /runs/[id]) —
///      la donnée reste, récupérable un temps.
///   2. anonymisation : après ANONYMIZE_DAYS d'inactivité, on vide les payloads
///      et toute trace pseudonyme (sessionId, resumeEmail) → `anonymizedAt`.
///   3. suppression   : après HARD_DELETE_DAYS d'inactivité, la ligne est
///      supprimée définitivement.
///
/// Les bornes sont volontairement larges (l'utilisateur anonyme n'a pas de
/// compte ; le code de reprise expire de toute façon à 30 jours).

export const ANONYMIZE_DAYS = 60;
export const HARD_DELETE_DAYS = 180;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface RetentionCutoffs {
  /// Runs inactifs avant cette date → à anonymiser.
  anonymizeBefore: Date;
  /// Runs inactifs avant cette date → à supprimer définitivement.
  deleteBefore: Date;
}

/// Calcule les dates seuils (pure → testable).
export function retentionCutoffs(
  now: Date,
  anonymizeDays: number = ANONYMIZE_DAYS,
  hardDeleteDays: number = HARD_DELETE_DAYS,
): RetentionCutoffs {
  return {
    anonymizeBefore: new Date(now.getTime() - anonymizeDays * DAY_MS),
    deleteBefore: new Date(now.getTime() - hardDeleteDays * DAY_MS),
  };
}
