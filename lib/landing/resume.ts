import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getServerAuthSession } from "@/lib/auth-session";
import {
  deriveBundleRunLifecycle,
  EDITABLE_BUNDLE_RUN_STATUSES,
  type BundleRunLifecycle,
} from "@/lib/bundles/run-lifecycle";

/**
 * Cookie anonyme posé par le parcours dossier — même nom que dans
 * app/d/[slug]/page.tsx, qui identifie les BundleRun des visiteurs
 * non connectés.
 */
const BUNDLE_COOKIE = "beldoc-bundle-session";

/**
 * Cookie de session posé côté client quand l'utilisateur ferme la bande
 * « Reprendre » (✕). Permet au serveur de ne plus rendre la bande au
 * prochain chargement complet → le HTML serveur et le premier rendu client
 * (qui lit sessionStorage) restent d'accord, pas de mismatch d'hydratation.
 * Cookie de session (sans expiration) : il disparaît à la fermeture du
 * navigateur, mêmes sémantiques que sessionStorage.
 */
export const RESUME_DISMISS_COOKIE = "docbel-resume-dismissed";

/** Dossier en cours, prêt à afficher dans la bande « Reprendre » de la home. */
export interface ActiveBundleRun {
  /** Id du BundleRun — permet de cibler UNE demande précise (multi-demande). */
  runId: string;
  slug: string;
  name: string;
  color: string;
  /** Nombre de documents déjà complétés dans ce parcours. */
  completed: number;
  /** Nombre total de documents du dossier. */
  total: number;
  /** Date de démarrage du parcours (ISO) — sérialisable vers le client. */
  startedAt: string;
  lifecycle: Extract<BundleRunLifecycle, "in_progress" | "completed_editable">;
}

/**
 * Cherche le dossier (BundleRun) « in_progress » le plus récent du visiteur,
 * identifié par sa session (connecté) OU par le cookie anonyme du parcours —
 * même logique d'identification que app/d/[slug]/page.tsx.
 *
 * Fail-soft : toute erreur (DB froide Neon, session indisponible) renvoie
 * null — la home ne doit jamais casser pour une bande de reprise.
 */
export async function loadActiveBundleRun(
  opts: { respectDismiss?: boolean } = {},
): Promise<ActiveBundleRun | null> {
  const runs = await loadActiveBundleRuns(opts);
  return runs[0] ?? null;
}

export async function loadActiveBundleRuns(
  opts: { respectDismiss?: boolean } = {},
): Promise<ActiveBundleRun[]> {
  // Par défaut on respecte le cookie de fermeture (bande de la home). Sur
  // /mon-dossier la zone « Reprendre » n'est pas une bande fermable → false.
  const respectDismiss = opts.respectDismiss ?? true;
  try {
    const cookieStore = await cookies();

    // L'utilisateur a fermé la bande pour cette session de navigation :
    // on s'épargne la requête et on ne rend rien côté serveur.
    if (respectDismiss && cookieStore.get(RESUME_DISMISS_COOKIE)?.value === "1") {
      return [];
    }

    const session = await getServerAuthSession().catch(() => null);
    const userId = session?.user?.id || null;
    const sessionId = cookieStore.get(BUNDLE_COOKIE)?.value || null;
    if (!userId && !sessionId) return [];

    // Priorité au compte connecté, sinon au cookie anonyme (comme d/[slug]).
    // findFirst + orderBy = le run en cours le plus récent, requête bornée.
    const runs = await prisma.bundleRun.findMany({
      where: userId
        ? { userId, status: { in: [...EDITABLE_BUNDLE_RUN_STATUSES] } }
        : {
            sessionId: sessionId as string,
            status: { in: [...EDITABLE_BUNDLE_RUN_STATUSES] },
          },
      orderBy: { startedAt: "desc" },
      take: 8,
      select: {
        id: true,
        startedAt: true,
        status: true,
        completedAt: true,
        anonymizedAt: true,
        completedTemplateIds: true,
        bundle: {
          select: {
            slug: true,
            name: true,
            color: true,
            active: true,
            items: { select: { id: true } },
          },
        },
      },
    });

    // Bundle désactivé entre-temps → /d/[slug] renverrait un 404, on ne
    // propose pas de le reprendre.
    return runs.flatMap((run) => {
      if (!run.bundle.active) return [];
      const completedIds = Array.isArray(run.completedTemplateIds)
        ? (run.completedTemplateIds as string[])
        : [];
      const total = run.bundle.items.length;
      const lifecycle = deriveBundleRunLifecycle(run);
      if (lifecycle === "abandoned" || lifecycle === "anonymized") return [];
      return [{
        runId: run.id,
        slug: run.bundle.slug,
        name: run.bundle.name,
        color: run.bundle.color,
        completed: Math.min(completedIds.length, total),
        total,
        startedAt: run.startedAt.toISOString(),
        lifecycle,
      }];
    });
  } catch {
    return [];
  }
}
