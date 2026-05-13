import { notFound } from "next/navigation";
import { headers, cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { BundleRunner } from "@/components/docbel/bundle-runner";
import { DocumentField } from "@/lib/documents/types";
import type { BundleCondition } from "@/lib/documents/bundle-conditions";
import { parseEligibilityAnswers } from "@/lib/bundles/eligibility";

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

  // Construire le mapping templateId → labels des champs (pour describeCondition)
  const fieldLabels: Record<string, string> = {};
  const templateNames: Record<string, string> = {};
  const templateFields: Record<string, { id: string; label: string; type: string; options?: { value: string; label: string }[] }[]> = {};
  for (const item of bundle.items) {
    templateNames[item.template.id] = item.template.tool.name;
    const schema = (item.template.schema as unknown as DocumentField[]) || [];
    templateFields[item.template.id] = schema.map((f) => ({
      id: f.id,
      label: f.label,
      type: f.type,
      options: f.options,
    }));
    for (const f of schema) {
      fieldLabels[`${item.template.id}::${f.id}`] = f.label;
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
      order: it.order,
      required: it.required,
      condition: (it.condition as unknown as BundleCondition) ?? null,
      template: {
        id: it.template.id,
        toolName: it.template.tool.name,
        toolSlug: it.template.tool.slug,
        toolDescription: it.template.tool.description,
        organisme: it.template.organisme,
        requiresSignature: it.template.requiresSignature,
      },
    })),
  };

  return (
    <div className="container max-w-3xl mx-auto py-6 px-4">
      <BundleRunner
        bundle={serializedBundle}
        runId={run?.id ?? null}
        resumeCode={run?.resumeCode ?? null}
        resumeCodeExpiresAt={run?.resumeCodeExpiresAt?.toISOString() ?? null}
        resumeEmail={run?.resumeEmail ?? null}
        eligibilityAnswers={parseEligibilityAnswers(run?.eligibilityAnswers)}
        completedTemplateIds={(run?.completedTemplateIds as string[]) || []}
        payloads={(run?.payloads as Record<string, Record<string, unknown>>) || {}}
        templateNames={templateNames}
        fieldLabels={fieldLabels}
      />
    </div>
  );
}
