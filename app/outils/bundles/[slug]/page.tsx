import { notFound } from "next/navigation";
import { headers, cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { BundleRunner } from "@/components/docbel/bundle-runner";
import { DocumentField } from "@/lib/documents/types";
import type { PdfFormField } from "@/lib/pdf-forms/types";
import type { BundleCondition } from "@/lib/documents/bundle-conditions";
import { parseEligibilityAnswers } from "@/lib/bundles/eligibility";
import { getDossier } from "@/lib/dossiers/registry";
import { selectDocuments, type DossierAnswers } from "@/lib/dossiers/types";

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
          template: {
            include: {
              tool: { select: { id: true, name: true, slug: true, description: true } },
              organisme: { select: { shortName: true, name: true, color: true } },
            },
          },
          pdfForm: {
            select: { id: true, slug: true, title: true, description: true, issuer: true, fields: true },
          },
        },
      },
    },
  });

  if (!bundle || !bundle.active) notFound();

  // Récupérer ou créer le BundleRun pour cet utilisateur
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

  // Construire le mapping {templateId|pdfFormId} → labels des champs
  // (pour describeCondition et l'éditeur de conditions admin).
  const fieldLabels: Record<string, string> = {};
  const templateNames: Record<string, string> = {};
  for (const item of bundle.items) {
    if (item.template) {
      templateNames[item.template.id] = item.template.tool.name;
      const schema = (item.template.schema as unknown as DocumentField[]) || [];
      for (const f of schema) fieldLabels[`${item.template.id}::${f.id}`] = f.label;
    }
    if (item.pdfForm) {
      templateNames[item.pdfForm.id] = item.pdfForm.title;
      const fields = (item.pdfForm.fields as unknown as PdfFormField[]) || [];
      for (const f of fields) {
        const label = f.label?.fr || f.label?.nl || f.label?.de || f.id;
        fieldLabels[`${item.pdfForm.id}::${f.id}`] = label;
      }
    }
  }

  const serializedBundle = {
    id: bundle.id,
    slug: bundle.slug,
    name: bundle.name,
    description: bundle.description,
    color: bundle.color,
    eligibilityQuestions: bundle.eligibilityQuestions,
    warnings: bundle.warnings,
    items: bundle.items.map((it) => ({
      id: it.id,
      templateId: it.templateId,
      pdfFormId: it.pdfFormId,
      order: it.order,
      required: it.required,
      condition: (it.condition as unknown as BundleCondition) ?? null,
      template: it.template
        ? {
            id: it.template.id,
            toolName: it.template.tool.name,
            toolSlug: it.template.tool.slug,
            toolDescription: it.template.tool.description,
            organisme: it.template.organisme,
            requiresSignature: it.template.requiresSignature,
          }
        : null,
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
  };

  // Si le dossier est piloté par code, on calcule la liste des documents
  // applicables aux réponses d'orientation actuelles via selectDocuments().
  // Tant que les questions ne sont pas répondues, on n'inclut que les docs
  // sans includeWhen (inconditionnels) → l'utilisateur voit dès l'arrivée
  // les documents toujours requis, et les conditionnels apparaissent au fur
  // et à mesure qu'il répond aux questions.
  const dossier = getDossier(slug);
  const eligibilityAnswers = parseEligibilityAnswers(run?.eligibilityAnswers);
  const applicableSlugs = dossier
    ? selectDocuments(dossier, eligibilityAnswers as unknown as DossierAnswers).map((d) => d.slug)
    : null;

  return (
    <div className="container max-w-3xl mx-auto py-6 px-4">
      <BundleRunner
        bundle={serializedBundle}
        runId={run?.id ?? null}
        resumeCode={run?.resumeCode ?? null}
        resumeCodeExpiresAt={run?.resumeCodeExpiresAt?.toISOString() ?? null}
        resumeEmail={run?.resumeEmail ?? null}
        eligibilityAnswers={eligibilityAnswers}
        completedTemplateIds={(run?.completedTemplateIds as string[]) || []}
        payloads={(run?.payloads as Record<string, Record<string, unknown>>) || {}}
        templateNames={templateNames}
        fieldLabels={fieldLabels}
        applicableSlugs={applicableSlugs}
      />
    </div>
  );
}
