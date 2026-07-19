// Loader TRANSVERSAL "Mes démarches" (/mes-demarches, Lot 3) : liste, TOUS
// dossiers confondus, les démarches (BundleRun) éditables du citoyen anonyme
// (userId legacy, sinon sessionId cookie). Contrairement à `/d/[slug]`
// (lib/bundles/completion.ts) qui charge UN dossier à la fois, cette vue
// agrège plusieurs dossiers → jamais réutiliser `loadDossierState` ici.

import { prisma } from "@/lib/prisma";
import {
  EDITABLE_BUNDLE_RUN_STATUSES,
  deriveBundleRunLifecycle,
} from "@/lib/bundles/run-lifecycle";
import { bundleRunHasProgress } from "@/lib/bundles/run-progress";
import {
  buildDemandeSummaries,
  type DemandeSummary,
  type DemandeSummaryInput,
} from "@/lib/bundles/demande-summary";

export interface MesDemarchesBundleMeta {
  id: string;
  slug: string;
  name: string;
  icon: string | null;
  color: string | null;
}

/// Entrée de la fonction PURE `groupRunsForMesDemarches`.
///
/// `bundle.itemCount` : voir la note sur `total` au-dessus de
/// `groupRunsForMesDemarches` — c'est le compte BRUT d'items du bundle
/// (`DocumentBundleItem`), pas le périmètre "visible/remplissable" exact de
/// `/d/[slug]`.
export interface MesDemarchesRunInput extends DemandeSummaryInput {
  updatedAt: Date | string;
  eligibilityAnswers: unknown;
  payloads: unknown;
  bundle: MesDemarchesBundleMeta & { itemCount: number };
}

export interface MesDemarchesGroup {
  bundle: MesDemarchesBundleMeta;
  demarches: DemandeSummary[]; // du plus récent au plus ancien
}

const toTime = (v: Date | string): number =>
  typeof v === "string" ? new Date(v).getTime() : v.getTime();

/// Regroupe des BundleRun de PLUSIEURS dossiers (potentiellement mélangés,
/// aucun ordre présupposé en entrée) par dossier. Règles :
/// - un run sans progression (`bundleRunHasProgress`) est exclu — même règle
///   que `/d/[slug]` (un run vide ne compte pas comme une démarche réelle) ;
///   un dossier dont TOUS les runs sont sans progression n'apparaît donc pas ;
/// - dans un groupe, les démarches sont résumées via `buildDemandeSummaries`
///   (déjà triées récent→ancien, index = ordre de création global au sein du
///   dossier) ;
/// - les GROUPES sont triés par activité la plus récente : `max(updatedAt)`
///   des démarches qu'ils contiennent (pas `startedAt` — un vieux dossier
///   repris aujourd'hui doit remonter en tête).
///
/// Note sur `total`/`completed` (Task 3.1 ; révisé en FIX PASS — la version
/// précédente de ce commentaire affirmait qu'un faux « terminé » était
/// impossible ici, ce qui était FAUX, cf. historique de la fonction) :
/// `/d/[slug]` calcule un total "visible/remplissable" exact PAR RUN
/// (`computeItemStatuses` + `applicableSlugs`, cf. l.341-364 de
/// `app/d/[slug]/page.tsx`), qui exige de charger les items du bundle + leurs
/// conditions + les compagnons déclenchés par les payloads déjà saisis.
/// `/mes-demarches` liste PLUSIEURS dossiers à la fois : reproduire ce calcul
/// pour chacun serait coûteux pour une simple vue de synthèse.
///
/// On utilise donc ici le résolveur PAR RUN de `buildDemandeSummaries`
/// (pas le mode "total global"), construit à partir du compte BRUT d'items
/// du bundle (`bundle.itemCount`, résolu par `loadMesDemarches` via
/// `_count.items` — un simple COUNT agrégé, pas de requête supplémentaire ni
/// de fetch des items eux-mêmes) et du `lifecycle` dérivé
/// (`deriveBundleRunLifecycle`) — le tout SANS charger les items ni les
/// compagnons déclenchés (coût que cette vue veut justement éviter) :
/// - run TERMINÉ (`lifecycle === "completed_editable"`) → `total =
///   max(itemCount, completedTemplateIds.length)`. Un compagnon C1 déclenché
///   ET complété fait grossir `completedTemplateIds` au-delà de `itemCount`
///   (qui ne compte que les items DE BASE du bundle) ; ce dépassement est
///   alors reporté au dénominateur ET au numérateur → barre pleine, à raison.
/// - run EN COURS (tout autre `lifecycle`) → `total =
///   max(itemCount, completedTemplateIds.length + 1)`. Le `+ 1` garantit
///   TOUJOURS une marge au-dessus du nombre déjà complété, même quand
///   `completedTemplateIds.length` a atteint ou dépassé `itemCount` — cas
///   d'un compagnon déclenché par les réponses déjà saisies mais pas encore
///   rempli (invisible pour `itemCount`, qui ne voit que les items de base).
///
/// Conséquence garantie : `completed < total` tant que le run n'est pas
/// `completed_editable` — la barre de progression ne peut donc JAMAIS
/// afficher 100 % pour une démarche que le pill "En cours" contredirait. En
/// contrepartie, le nombre de compagnons réellement en attente est
/// APPROXIMÉ à 1 quel que soit leur nombre réel (un run avec 2 compagnons
/// déclenchés non remplis affichera par ex. 3 sur 4 au lieu de 3 sur 5) : ce
/// n'est pas le compte exact que fournit `/d/[slug]`, seulement une
/// approximation qui ne ment jamais dans le sens "terminé". Le compte
/// visible/remplissable exact reste la responsabilité de `/d/[slug]` ; cette
/// vue de synthèse reste volontairement légère.
export function groupRunsForMesDemarches(
  runs: MesDemarchesRunInput[],
): MesDemarchesGroup[] {
  const withProgress = runs.filter((run) =>
    bundleRunHasProgress({
      completedTemplateIds: run.completedTemplateIds,
      eligibilityAnswers: run.eligibilityAnswers,
      payloads: run.payloads,
    }),
  );

  const runsByBundleId = new Map<string, MesDemarchesRunInput[]>();
  for (const run of withProgress) {
    const existing = runsByBundleId.get(run.bundle.id);
    if (existing) existing.push(run);
    else runsByBundleId.set(run.bundle.id, [run]);
  }

  return [...runsByBundleId.values()]
    .map((bundleRuns) => {
      const { bundle } = bundleRuns[0];
      const demarches = buildDemandeSummaries(bundleRuns, (run) => {
        const completedCount = Array.isArray(run.completedTemplateIds)
          ? run.completedTemplateIds.length
          : 0;
        const done = deriveBundleRunLifecycle(run) === "completed_editable";
        const total = done
          ? Math.max(bundle.itemCount, completedCount)
          : Math.max(bundle.itemCount, completedCount + 1);
        return { total, completed: Math.min(completedCount, total) };
      });
      const lastActivity = Math.max(
        ...bundleRuns.map((r) => toTime(r.updatedAt)),
      );
      const group: MesDemarchesGroup = {
        bundle: {
          id: bundle.id,
          slug: bundle.slug,
          name: bundle.name,
          icon: bundle.icon,
          color: bundle.color,
        },
        demarches,
      };
      return { group, lastActivity };
    })
    .sort((a, b) => b.lastActivity - a.lastActivity)
    .map((entry) => entry.group);
}

/// Charge les démarches TRANSVERSALES (tous dossiers confondus) du citoyen
/// anonyme. Ownership userId-first — copie EXACTE du pattern de
/// `app/d/[slug]/page.tsx` (l.104-116) : si `userId` est présent, on filtre
/// UNIQUEMENT par `userId` (jamais un OR avec `sessionId` — un cookie de
/// session encore présent après connexion ne doit pas élargir le périmètre).
/// Sinon on filtre par `sessionId`. Si ni l'un ni l'autre → `[]` (jamais de
/// requête non bornée par identité).
export async function loadMesDemarches(owner: {
  userId: string | null;
  sessionId: string | null;
}): Promise<MesDemarchesGroup[]> {
  const { userId, sessionId } = owner;
  if (!userId && !sessionId) return [];

  const runs = await prisma.bundleRun.findMany({
    where: userId
      ? {
          userId,
          status: { in: [...EDITABLE_BUNDLE_RUN_STATUSES] },
          bundle: { active: true },
        }
      : {
          sessionId: sessionId!,
          status: { in: [...EDITABLE_BUNDLE_RUN_STATUSES] },
          bundle: { active: true },
        },
    include: {
      bundle: {
        select: {
          id: true,
          slug: true,
          name: true,
          icon: true,
          color: true,
          _count: { select: { items: true } },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });

  return groupRunsForMesDemarches(
    runs.map((run) => ({
      id: run.id,
      startedAt: run.startedAt,
      updatedAt: run.updatedAt,
      status: run.status,
      completedAt: run.completedAt,
      anonymizedAt: run.anonymizedAt,
      completedTemplateIds: run.completedTemplateIds,
      eligibilityAnswers: run.eligibilityAnswers,
      payloads: run.payloads,
      bundle: {
        id: run.bundle.id,
        slug: run.bundle.slug,
        name: run.bundle.name,
        icon: run.bundle.icon,
        color: run.bundle.color,
        itemCount: run.bundle._count.items,
      },
    })),
  );
}
