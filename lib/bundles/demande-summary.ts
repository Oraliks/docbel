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

/// Progression d'UNE demande : `total` doit être le nombre de documents
/// VISIBLES (même périmètre que le compteur « X sur N » du runner, cf.
/// `computeItemStatuses` / `runnerCompletedCount`) — jamais le nombre total
/// d'items du bundle, qui inclut les items masqués « non requis pour votre
/// situation ». `completed` doit être compté dans CE MÊME périmètre.
export interface DemandeProgress {
  completed: number;
  total: number;
}

const toISO = (v: Date | string): string =>
  typeof v === "string" ? v : v.toISOString();

function resolveClampedProgress(
  run: DemandeSummaryInput,
  total: number,
): DemandeProgress {
  const completedIds = Array.isArray(run.completedTemplateIds)
    ? (run.completedTemplateIds as string[])
    : [];
  return { total, completed: Math.min(completedIds.length, total) };
}

/// Construit les résumés affichables des demandes d'un dossier. `index` est
/// assigné par ordre de création (startedAt asc) ; la liste renvoyée est
/// ordonnée récent→ancien pour l'affichage.
///
/// `progress` :
/// - un total GLOBAL unique (rétro-compat / cas simple sans items
///   conditionnels) — `completed` est alors dérivé par clampage brut de
///   `completedTemplateIds` sur ce total ;
/// - ou (recommandé) un résolveur PAR RUN renvoyant `{ total, completed }`
///   dans le périmètre VISIBLE de CE run — nécessaire dès qu'un dossier a des
///   items conditionnels : deux demandes du même dossier peuvent avoir des
///   réponses différentes, donc des périmètres visibles différents.
export function buildDemandeSummaries(
  runs: DemandeSummaryInput[],
  progress: number | ((run: DemandeSummaryInput) => DemandeProgress),
): DemandeSummary[] {
  const byCreation = [...runs].sort((a, b) =>
    toISO(a.startedAt).localeCompare(toISO(b.startedAt)),
  );
  const indexByRun = new Map<string, number>();
  byCreation.forEach((run, i) => indexByRun.set(run.id, i + 1));

  return [...runs]
    .sort((a, b) => toISO(b.startedAt).localeCompare(toISO(a.startedAt)))
    .map((run) => {
      const { total, completed } =
        typeof progress === "function"
          ? progress(run)
          : resolveClampedProgress(run, progress);
      return {
        runId: run.id,
        index: indexByRun.get(run.id) ?? 1,
        startedAtISO: toISO(run.startedAt),
        completed,
        total,
        lifecycle: deriveBundleRunLifecycle(run),
      };
    });
}
