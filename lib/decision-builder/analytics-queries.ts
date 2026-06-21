/// Requêtes d'agrégation pour le dashboard analytics du Decision Builder.
/// Lit la table `BundleAnalyticsEvent` (events /mon-dossier + admin). Pas de
/// `import "server-only"` (cohérent avec server.ts) — l'import Prisma le rend
/// server-only en pratique.

import { prisma, withDbRetry } from "@/lib/prisma";

function since(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

// ── Funnel d'orientation ────────────────────────────────────────────────────

export interface FunnelData {
  started: number;
  stepCompleted: number;
  resultShown: number;
  bundleOpened: number;
  runCreated: number;
  abandoned: number;
}

export async function getFunnel(days = 30): Promise<FunnelData> {
  const rows = await withDbRetry(() =>
    prisma.bundleAnalyticsEvent.groupBy({
      by: ["eventType"],
      where: {
        createdAt: { gte: since(days) },
        eventType: {
          in: [
            "wizard_started",
            "wizard_step_completed",
            "wizard_result_shown",
            "wizard_abandoned",
            "bundle_opened",
            "run_created",
          ],
        },
      },
      _count: { _all: true },
    }),
  );
  const m = new Map(rows.map((r) => [r.eventType, r._count._all]));
  return {
    started: m.get("wizard_started") ?? 0,
    stepCompleted: m.get("wizard_step_completed") ?? 0,
    resultShown: m.get("wizard_result_shown") ?? 0,
    bundleOpened: m.get("bundle_opened") ?? 0,
    runCreated: m.get("run_created") ?? 0,
    abandoned: m.get("wizard_abandoned") ?? 0,
  };
}

// ── Demande par dossier + par disponibilité (dont « orpheline ») ────────────

export interface ResultDemand {
  byAvailability: { availability: string; count: number }[];
  topSlugs: { slug: string; count: number; availability: string }[];
}

export async function getResultDemand(days = 30): Promise<ResultDemand> {
  const rows = await withDbRetry(() =>
    prisma.bundleAnalyticsEvent.findMany({
      where: { eventType: "wizard_result_shown", createdAt: { gte: since(days) } },
      select: { metadataJson: true },
      take: 5000,
    }),
  );

  const availCount = new Map<string, number>();
  const slugCount = new Map<string, { count: number; availability: string }>();
  for (const r of rows) {
    const meta = (r.metadataJson ?? {}) as { slug?: string; availability?: string };
    const availability = meta.availability ?? "inconnu";
    availCount.set(availability, (availCount.get(availability) ?? 0) + 1);
    const slug = meta.slug && meta.slug.length ? meta.slug : "(sans dossier)";
    const prev = slugCount.get(slug);
    slugCount.set(slug, {
      count: (prev?.count ?? 0) + 1,
      availability,
    });
  }

  return {
    byAvailability: [...availCount.entries()]
      .map(([availability, count]) => ({ availability, count }))
      .sort((a, b) => b.count - a.count),
    topSlugs: [...slugCount.entries()]
      .map(([slug, v]) => ({ slug, count: v.count, availability: v.availability }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20),
  };
}

// ── Recherches sans résultat sur /mon-dossier ───────────────────────────────

export interface NoResultQuery {
  query: string;
  count: number;
}

export async function getNoResultQueries(
  days = 30,
  limit = 25,
): Promise<NoResultQuery[]> {
  const rows = await withDbRetry(() =>
    prisma.bundleAnalyticsEvent.findMany({
      where: { eventType: "search_no_result", createdAt: { gte: since(days) } },
      select: { metadataJson: true },
      take: 5000,
    }),
  );
  const counts = new Map<string, number>();
  for (const r of rows) {
    const meta = (r.metadataJson ?? {}) as { q?: string };
    const q = (meta.q ?? "").trim().toLowerCase();
    if (!q) continue;
    counts.set(q, (counts.get(q) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([query, count]) => ({ query, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

// ── Activité admin (Decision Builder) ───────────────────────────────────────

export interface AdminActivity {
  published: number;
  simulated: number;
  validationFailed: number;
  restored: number;
}

export async function getAdminActivity(days = 30): Promise<AdminActivity> {
  const rows = await withDbRetry(() =>
    prisma.bundleAnalyticsEvent.groupBy({
      by: ["eventType"],
      where: {
        createdAt: { gte: since(days) },
        eventType: {
          in: [
            "decision_tree_published",
            "decision_tree_simulated",
            "decision_tree_validation_failed",
            "decision_tree_restored",
          ],
        },
      },
      _count: { _all: true },
    }),
  );
  const m = new Map(rows.map((r) => [r.eventType, r._count._all]));
  return {
    published: m.get("decision_tree_published") ?? 0,
    simulated: m.get("decision_tree_simulated") ?? 0,
    validationFailed: m.get("decision_tree_validation_failed") ?? 0,
    restored: m.get("decision_tree_restored") ?? 0,
  };
}

export interface DecisionAnalytics {
  funnel: FunnelData;
  demand: ResultDemand;
  noResult: NoResultQuery[];
  admin: AdminActivity;
  days: number;
}

export async function getDecisionAnalytics(days = 30): Promise<DecisionAnalytics> {
  const [funnel, demand, noResult, admin] = await Promise.all([
    getFunnel(days),
    getResultDemand(days),
    getNoResultQueries(days),
    getAdminActivity(days),
  ]);
  return { funnel, demand, noResult, admin, days };
}
