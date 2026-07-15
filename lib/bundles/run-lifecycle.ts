export type BundleRunLifecycle =
  | "in_progress"
  | "completed_editable"
  | "abandoned"
  | "anonymized";

export interface BundleRunLifecycleInput {
  status: string;
  completedAt: Date | string | null;
  anonymizedAt?: Date | string | null;
}

/**
 * Traduit les colonnes historiques de BundleRun en un cycle de vie métier
 * non ambigu. `status="in_progress"` signifie que le run reste OUVERT aux
 * modifications ; `completedAt` indique qu'il a déjà atteint la complétion.
 */
export function deriveBundleRunLifecycle(
  run: BundleRunLifecycleInput,
): BundleRunLifecycle {
  if (run.anonymizedAt) return "anonymized";
  if (run.status === "abandoned") return "abandoned";
  if (run.status === "completed" || run.completedAt) {
    return "completed_editable";
  }
  return "in_progress";
}

/** Un dossier complété reste modifiable ; seuls abandon/anonymisation ferment l'accès. */
export function isBundleRunEditable(run: BundleRunLifecycleInput): boolean {
  const lifecycle = deriveBundleRunLifecycle(run);
  return lifecycle === "in_progress" || lifecycle === "completed_editable";
}

/** Filtre Prisma compatible avec les anciens runs `status="completed"`. */
export const EDITABLE_BUNDLE_RUN_STATUSES = [
  "in_progress",
  "completed",
] as const;
