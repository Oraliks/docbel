import { cache } from "react";
import { prisma, withDbRetry } from "@/lib/prisma";
import { periodBounds, type Period } from "./dashboard-stats-helpers";
import {
  buildParcoursModel,
  zeroParcoursCounts,
  GENERATED_PDF_DELIVERIES,
  type ParcoursFunnelModel,
  type ParcoursCounts,
} from "./parcours-funnel-core";

/**
 * Données du funnel « Parcours » unifié — I/O DB. La forme/l'ordre des étapes et
 * des métriques vit dans `parcours-funnel-core.ts` (pur, testé). Résilient :
 * toute erreur DB (cold-start Neon…) → modèle à zéro plutôt qu'un crash.
 *
 * Lot 5 — de-conflation : on interroge la BONNE source pour chaque unité au lieu
 * d'empiler trois unités dans une seule colonne.
 *   - étapes d'interaction : `BundleAnalyticsEvent` (5 events de parcours) ;
 *   - « PDF générés » : `PdfFormSubmissionLog` (succès, delivery download/doccle) ;
 *   - « Dossiers complets » : `BundleRun.completedAt` posé sur la période ;
 *   - « Documents récupérés » : event `documents_downloaded` (zip/e-mail).
 */

const FUNNEL_EVENTS = [
  "search_performed",
  "wizard_started",
  "wizard_result_shown",
  "bundle_opened",
  "run_created",
  "documents_downloaded",
] as const;

export const getParcoursFunnel = cache(
  async (period: Period): Promise<ParcoursFunnelModel> => {
    try {
      const { start } = periodBounds(period);
      const [events, pdfGenerated, dossiersComplets] = await Promise.all([
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
        // « PDF générés » = un PDF réellement produit (download/doccle). Un
        // `save` persiste dans le dossier sans PDF → jamais compté ici (cf.
        // classifyPdfDelivery).
        withDbRetry(() =>
          prisma.pdfFormSubmissionLog.count({
            where: {
              createdAt: { gte: start },
              success: true,
              delivery: { in: [...GENERATED_PDF_DELIVERIES] },
            },
          }),
        ),
        // « Dossiers complets » = runs horodatés complétés sur la période (même
        // définition « completedAt dans la fenêtre » que getBundleFunnel).
        withDbRetry(() =>
          prisma.bundleRun.count({ where: { completedAt: { gte: start } } }),
        ),
      ]);
      const m = new Map(events.map((e) => [e.eventType, e._count._all]));
      const counts: ParcoursCounts = {
        search: m.get("search_performed") ?? 0,
        wizardStarted: m.get("wizard_started") ?? 0,
        resultShown: m.get("wizard_result_shown") ?? 0,
        opened: m.get("bundle_opened") ?? 0,
        runCreated: m.get("run_created") ?? 0,
        pdfGenerated,
        dossiersComplets,
        documentsRetrieved: m.get("documents_downloaded") ?? 0,
      };
      return buildParcoursModel(counts);
    } catch {
      return buildParcoursModel(zeroParcoursCounts());
    }
  },
);
