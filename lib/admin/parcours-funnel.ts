import { cache } from "react";
import { prisma, withDbRetry } from "@/lib/prisma";
import { periodBounds, type Period } from "./dashboard-stats-helpers";
import {
  assembleParcoursStages,
  zeroParcoursCounts,
  type ParcoursStage,
  type ParcoursCounts,
} from "./parcours-funnel-core";

/**
 * Données du funnel « Parcours » unifié (Lot 3) — I/O DB. La forme/l'ordre des
 * étapes vit dans `parcours-funnel-core.ts` (pur, testé). Résilient : toute
 * erreur DB (cold-start Neon…) → funnel à zéro plutôt qu'un crash.
 *
 * Sources : `BundleAnalyticsEvent` (5 events de parcours + `documents_downloaded`)
 * pour les étapes ; `PdfFormSubmissionLog` pour le volume PDF total (contexte,
 * hors funnel car non attribuable à un run).
 */

export interface ParcoursFunnelData {
  stages: ParcoursStage[];
  /** Documents PDF générés sur la période, tous formulaires (contexte). */
  totalPdfGenerated: number;
}

const FUNNEL_EVENTS = [
  "search_performed",
  "wizard_started",
  "wizard_result_shown",
  "bundle_opened",
  "run_created",
  "documents_downloaded",
] as const;

export const getParcoursFunnel = cache(
  async (period: Period): Promise<ParcoursFunnelData> => {
    try {
      const { start } = periodBounds(period);
      const [events, totalPdfGenerated] = await Promise.all([
        withDbRetry(() =>
          prisma.bundleAnalyticsEvent.groupBy({
            by: ["eventType"],
            where: {
              createdAt: { gte: start },
              eventType: { in: [...FUNNEL_EVENTS] },
            },
            _count: { _all: true },
          }),
        ),
        withDbRetry(() =>
          prisma.pdfFormSubmissionLog.count({
            where: { createdAt: { gte: start }, success: true },
          }),
        ),
      ]);
      const m = new Map(events.map((e) => [e.eventType, e._count._all]));
      const counts: ParcoursCounts = {
        search: m.get("search_performed") ?? 0,
        wizardStarted: m.get("wizard_started") ?? 0,
        resultShown: m.get("wizard_result_shown") ?? 0,
        opened: m.get("bundle_opened") ?? 0,
        runCreated: m.get("run_created") ?? 0,
        documents: m.get("documents_downloaded") ?? 0,
      };
      return { stages: assembleParcoursStages(counts), totalPdfGenerated };
    } catch {
      return {
        stages: assembleParcoursStages(zeroParcoursCounts()),
        totalPdfGenerated: 0,
      };
    }
  },
);
