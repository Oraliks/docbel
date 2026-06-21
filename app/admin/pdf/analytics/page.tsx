import { redirect } from "next/navigation";
import { requireAdminAuth } from "@/lib/auth-check";
import { prisma } from "@/lib/prisma";
import {
  bucketSubmissionsByDay,
  computeSuccessRate,
  reportsByFieldType,
} from "@/lib/pdf-forms/analytics";
import {
  PdfAnalyticsDashboard,
  type PdfAnalyticsViewModel,
} from "@/components/admin/pdf-forms/analytics-dashboard";

export const dynamic = "force-dynamic";

/// Fenêtre d'analyse pour les séries temporelles et les KPI de soumissions.
const WINDOW_DAYS = 30;
/// Borne haute du chargement des soumissions (sécurité : on ne lit qu'une
/// fenêtre récente, jamais toute la table).
const LOAD_DAYS = 90;
/// Seuil "expire bientôt" pour les brouillons RGPD.
const EXPIRING_SOON_HOURS = 48;

/**
 * Page admin Analytics PDF Forms. Server Component : récupère l'auth admin,
 * charge des agrégats ciblés via Prisma (count/groupBy + findMany bornés à la
 * fenêtre récente, select minimal), transforme avec les fonctions pures de
 * `lib/pdf-forms/analytics`, puis délègue le rendu au dashboard client.
 */
export default async function PdfAnalyticsPage() {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) redirect("/login");

  const now = new Date();
  const windowStart = new Date(now);
  windowStart.setDate(windowStart.getDate() - (WINDOW_DAYS - 1));
  windowStart.setHours(0, 0, 0, 0);
  const loadStart = new Date(now);
  loadStart.setDate(loadStart.getDate() - LOAD_DAYS);
  const expiringThreshold = new Date(
    now.getTime() + EXPIRING_SOON_HOURS * 60 * 60 * 1000
  );

  // Toutes les requêtes sont indépendantes → en parallèle.
  const [
    formStatusGroups,
    submissionRows,
    activeDrafts,
    draftsExpiringSoon,
    pendingReports,
    pendingReportRows,
  ] = await Promise.all([
    // KPI (a) : répartition des formulaires par statut (draft/published/archived).
    prisma.pdfForm.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    // KPI (b) + graphe 1 : soumissions récentes, champs minimaux (pas de PII).
    prisma.pdfFormSubmissionLog.findMany({
      where: { createdAt: { gte: loadStart } },
      select: { createdAt: true, success: true, delivery: true },
    }),
    // KPI (c) : brouillons RGPD encore valides (non expirés).
    prisma.pdfFormDraft.count({
      where: { expiresAt: { gt: now } },
    }),
    // KPI (c) bis : brouillons valides qui expirent dans < 48 h.
    prisma.pdfFormDraft.count({
      where: { expiresAt: { gt: now, lte: expiringThreshold } },
    }),
    // KPI (d) : signalements de validation en attente.
    prisma.formValidationReport.count({
      where: { status: "pending" },
    }),
    // Graphe 2 : signalements en attente, regroupés par type de champ.
    prisma.formValidationReport.findMany({
      where: { status: "pending" },
      select: { fieldType: true },
    }),
  ]);

  // Répartition des statuts de formulaire.
  let publishedForms = 0;
  let draftForms = 0;
  let archivedForms = 0;
  for (const g of formStatusGroups) {
    if (g.status === "published") publishedForms = g._count._all;
    else if (g.status === "draft") draftForms = g._count._all;
    else if (g.status === "archived") archivedForms = g._count._all;
  }

  // Soumissions de la FENÊTRE (30 j) pour le KPI + taux de succès.
  const windowSubmissions = submissionRows.filter(
    (r) => r.createdAt >= windowStart
  );
  const successRate = computeSuccessRate(windowSubmissions);

  const viewModel: PdfAnalyticsViewModel = {
    publishedForms,
    draftForms,
    archivedForms,
    submissions30d: windowSubmissions.length,
    successRate30d: successRate.rate,
    activeDrafts,
    draftsExpiringSoon,
    pendingReports,
    windowDays: WINDOW_DAYS,
    dailySubmissions: bucketSubmissionsByDay(
      windowSubmissions,
      WINDOW_DAYS,
      now
    ),
    reportsByFieldType: reportsByFieldType(pendingReportRows),
  };

  return (
    <div className="flex flex-col gap-6 py-6 px-4 lg:px-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
        <p className="text-muted-foreground mt-2">
          Usage des formulaires PDF — soumissions, taux de succès, brouillons
          RGPD et signalements de validation. Aucune donnée nominative.
        </p>
      </div>
      <PdfAnalyticsDashboard data={viewModel} />
    </div>
  );
}
