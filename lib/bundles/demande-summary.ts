import {
  deriveBundleRunLifecycle,
  type BundleRunLifecycle,
} from "./run-lifecycle";

export interface DemandeSummaryInput {
  id: string;
  startedAt: Date | string;
  completedTemplateIds: unknown;
  status: string;
  completedAt: Date | string | null;
  anonymizedAt?: Date | string | null;
}

export interface DemandeSummary {
  runId: string;
  /// Numéro d'ordre de CRÉATION (1-based), stable — sert le libellé « Demande n°N ».
  index: number;
  startedAtISO: string;
  completed: number;
  total: number;
  lifecycle: BundleRunLifecycle;
}

const toISO = (v: Date | string): string =>
  typeof v === "string" ? v : v.toISOString();

/// Construit les résumés affichables des demandes d'un dossier. `index` est
/// assigné par ordre de création (startedAt asc) ; la liste renvoyée est
/// ordonnée récent→ancien pour l'affichage.
export function buildDemandeSummaries(
  runs: DemandeSummaryInput[],
  total: number,
): DemandeSummary[] {
  const byCreation = [...runs].sort((a, b) =>
    toISO(a.startedAt).localeCompare(toISO(b.startedAt)),
  );
  const indexByRun = new Map<string, number>();
  byCreation.forEach((run, i) => indexByRun.set(run.id, i + 1));

  return [...runs]
    .sort((a, b) => toISO(b.startedAt).localeCompare(toISO(a.startedAt)))
    .map((run) => {
      const completedIds = Array.isArray(run.completedTemplateIds)
        ? (run.completedTemplateIds as string[])
        : [];
      return {
        runId: run.id,
        index: indexByRun.get(run.id) ?? 1,
        startedAtISO: toISO(run.startedAt),
        completed: Math.min(completedIds.length, total),
        total,
        lifecycle: deriveBundleRunLifecycle(run),
      };
    });
}
