import { notFound } from "next/navigation";
import { headers, cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { BundleRunner } from "@/components/docbel/bundle-runner";
import type { FormPayload, PdfFormField } from "@/lib/pdf-forms/types";
import { collectTriggeredSlugs, parseTriggers } from "@/lib/pdf-forms/triggers";
import type { BundleCondition } from "@/lib/bundles/conditions";
import { parseEligibilityAnswers } from "@/lib/bundles/eligibility";
import { getDossier } from "@/lib/dossiers/registry";
import { dossierQuestionsToEligibility, selectDocuments, type DossierAnswers } from "@/lib/dossiers/types";

export const dynamic = "force-dynamic";

const BUNDLE_COOKIE = "beldoc-bundle-session";

export default async function BundleRoute({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const bundle = await prisma.documentBundle.findUnique({
    where: { slug },
    include: {
      items: {
        orderBy: { order: "asc" },
        include: {
          pdfForm: {
            select: {
              id: true, slug: true, title: true, description: true,
              issuer: true, fields: true, triggers: true,
            },
          },
        },
      },
    },
  });

  if (!bundle || !bundle.active) notFound();

  const session = await auth.api.getSession({ headers: await headers() });
  const userId = session?.user?.id || null;
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(BUNDLE_COOKIE)?.value || null;

  let run = null;
  if (userId || sessionId) {
    const where = userId
      ? { bundleId: bundle.id, userId, status: "in_progress" }
      : { bundleId: bundle.id, sessionId: sessionId!, status: "in_progress" };
    run = await prisma.bundleRun.findFirst({ where, orderBy: { startedAt: "desc" } });
  }

  const payloads = (run?.payloads as Record<string, Record<string, unknown>>) || {};

  const fieldLabels: Record<string, string> = {};
  const templateNames: Record<string, string> = {};
  for (const item of bundle.items) {
    if (item.pdfForm) {
      templateNames[item.pdfForm.id] = item.pdfForm.title;
      const fields = (item.pdfForm.fields as unknown as PdfFormField[]) || [];
      for (const f of fields) {
        const label = f.label?.fr || f.label?.nl || f.label?.de || f.id;
        fieldLabels[`${item.pdfForm.id}::${f.id}`] = label;
      }
    }
  }

  // --- Évaluation des déclencheurs ---
  // Pour chaque PdfForm complété (ayant un payload), on évalue ses triggers
  // contre son payload et on collecte les slugs requis. Les slugs déjà présents
  // dans le bundle ne sont pas re-matérialisés.
  const existingSlugs = new Set(
    bundle.items.map((it) => it.pdfForm?.slug).filter((s): s is string => !!s)
  );
  const triggeredSlugs = new Set<string>();
  for (const item of bundle.items) {
    if (!item.pdfForm) continue;
    const payload = (payloads[item.pdfForm.id] as FormPayload) || null;
    if (!payload) continue;
    const triggers = parseTriggers(item.pdfForm.triggers);
    if (triggers.length === 0) continue;
    for (const s of collectTriggeredSlugs(triggers, payload)) {
      if (!existingSlugs.has(s)) triggeredSlugs.add(s);
    }
  }

  // Charge les PdfForms cibles depuis leur slug (un seul query) et matérialise
  // des items virtuels (sans DocumentBundleItem en DB).
  const triggeredForms =
    triggeredSlugs.size > 0
      ? await prisma.pdfForm.findMany({
          where: { slug: { in: [...triggeredSlugs] }, status: "published", active: true },
          select: {
            id: true, slug: true, title: true, description: true, issuer: true, fields: true,
          },
        })
      : [];

  for (const f of triggeredForms) {
    templateNames[f.id] = f.title;
    const fields = (f.fields as unknown as PdfFormField[]) || [];
    for (const fld of fields) {
      const label = fld.label?.fr || fld.label?.nl || fld.label?.de || fld.id;
      fieldLabels[`${f.id}::${fld.id}`] = label;
    }
  }

  // Code-driven dossiers (TS) prennent la priorité sur les questions stockées
  // en DB sur le DocumentBundle. Permet d'avoir le code comme source de
  // vérité sans avoir à reseeder la DB à chaque évolution du questionnaire.
  const dossierForQuestions = getDossier(slug);
  const eligibilityQuestionsSerialized = dossierForQuestions
    ? dossierQuestionsToEligibility(dossierForQuestions.questions)
    : bundle.eligibilityQuestions;

  const serializedBundle = {
    id: bundle.id,
    slug: bundle.slug,
    name: bundle.name,
    description: bundle.description,
    color: bundle.color,
    eligibilityQuestions: eligibilityQuestionsSerialized,
    warnings: bundle.warnings,
    items: [
      ...bundle.items.map((it) => ({
        id: it.id,
        templateId: null as string | null,
        pdfFormId: it.pdfFormId,
        order: it.order,
        required: it.required,
        condition: (it.condition as unknown as BundleCondition) ?? null,
        template: null,
        triggered: false as const,
        pdfForm: it.pdfForm
          ? {
              id: it.pdfForm.id,
              slug: it.pdfForm.slug,
              title: it.pdfForm.title,
              description: it.pdfForm.description,
              issuer: it.pdfForm.issuer,
            }
          : null,
      })),
      // Items virtuels matérialisés par les triggers — affichés en bas du
      // parcours, marqués `triggered: true` pour que le runner les distingue.
      ...triggeredForms.map((f, idx) => ({
        id: `triggered-${f.id}`,
        templateId: null as string | null,
        pdfFormId: f.id,
        order: bundle.items.length + idx,
        required: true,
        condition: null as BundleCondition,
        template: null,
        triggered: true as const,
        pdfForm: {
          id: f.id,
          slug: f.slug,
          title: f.title,
          description: f.description,
          issuer: f.issuer,
        },
      })),
    ],
  };

  const dossier = getDossier(slug);
  const eligibilityAnswers = parseEligibilityAnswers(run?.eligibilityAnswers);
  const applicableSlugs = dossier
    ? selectDocuments(dossier, eligibilityAnswers as unknown as DossierAnswers).map((d) => d.slug)
    : null;
  // Les formulaires matérialisés par trigger sont toujours applicables — on
  // les rajoute aux applicables pour qu'ils ne soient pas masqués par le
  // filtre dossier.
  const finalApplicableSlugs = applicableSlugs
    ? [...applicableSlugs, ...triggeredSlugs]
    : null;

  // max-w-5xl (1024px) au lieu du max-w-3xl (768px) historique : le 3xl
  // était pensé pour un long formulaire vertical, mais le BundleRunner
  // affiche des cartes (parcours + documents + pré-qualification) qui
  // respirent mieux à ~1024px. Sur écran large l'ancien était à ~50% de la
  // fenêtre, ce qui donnait l'impression d'une page « collée au centre ».
  return (
    <div className="container max-w-5xl mx-auto py-6 px-4 lg:px-6">
      <BundleRunner
        bundle={serializedBundle}
        runId={run?.id ?? null}
        resumeCode={run?.resumeCode ?? null}
        resumeCodeExpiresAt={run?.resumeCodeExpiresAt?.toISOString() ?? null}
        resumeEmail={run?.resumeEmail ?? null}
        eligibilityAnswers={eligibilityAnswers}
        completedTemplateIds={(run?.completedTemplateIds as string[]) || []}
        payloads={payloads}
        templateNames={templateNames}
        fieldLabels={fieldLabels}
        applicableSlugs={finalApplicableSlugs}
      />
    </div>
  );
}
