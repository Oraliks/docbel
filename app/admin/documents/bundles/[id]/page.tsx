import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  BundleEditor,
  type AvailableTemplate,
  type BundleEditorData,
  type BundleEditorItem,
} from "@/components/admin/documents/bundle-editor";
import type { BundleCondition } from "@/lib/documents/bundle-conditions";
import { DocumentField } from "@/lib/documents/types";

export const dynamic = "force-dynamic";

export default async function EditBundlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [bundle, templates] = await Promise.all([
    prisma.documentBundle.findUnique({
      where: { id },
      include: {
        items: {
          orderBy: { order: "asc" },
          include: {
            template: {
              include: {
                tool: { select: { id: true, name: true, slug: true } },
                organisme: { select: { id: true, shortName: true, color: true } },
              },
            },
          },
        },
      },
    }),
    prisma.documentTemplate.findMany({
      where: { status: "published" },
      include: {
        tool: { select: { id: true, name: true, slug: true } },
        organisme: { select: { id: true, shortName: true, color: true } },
      },
      orderBy: { tool: { name: "asc" } },
    }),
  ]);

  if (!bundle) notFound();

  const availableTemplates: AvailableTemplate[] = templates.map((t) => ({
    id: t.id,
    toolId: t.tool.id,
    toolName: t.tool.name,
    toolSlug: t.tool.slug,
    organisme: t.organisme,
  }));

  const templateSchemas: Record<
    string,
    { id: string; label: string; type: string; options?: { value: string; label: string }[] }[]
  > = {};
  for (const t of templates) {
    const fields = (t.schema as unknown as DocumentField[]) || [];
    templateSchemas[t.id] = fields.map((f) => ({
      id: f.id,
      label: f.label,
      type: f.type,
      options: f.options,
    }));
  }

  const items: BundleEditorItem[] = bundle.items.map((it) => ({
    id: it.id,
    templateId: it.templateId,
    order: it.order,
    required: it.required,
    condition: (it.condition as unknown as BundleCondition) ?? null,
    template: {
      id: it.template.id,
      toolId: it.template.tool.id,
      toolName: it.template.tool.name,
      toolSlug: it.template.tool.slug,
      organisme: it.template.organisme,
    },
  }));

  const initial: BundleEditorData = {
    id: bundle.id,
    slug: bundle.slug,
    name: bundle.name,
    description: bundle.description,
    icon: bundle.icon,
    color: bundle.color,
    active: bundle.active,
    lifeEventCategory: bundle.lifeEventCategory,
    showOnOnboarding: bundle.showOnOnboarding,
    vocabularyTags: bundle.vocabularyTags,
    eligibilityQuestions: bundle.eligibilityQuestions,
    warnings: bundle.warnings,
    items,
  };

  return (
    <div className="flex flex-col gap-6 py-6 px-4 lg:px-6">
      <BundleEditor
        initial={initial}
        availableTemplates={availableTemplates}
        templateSchemas={templateSchemas}
      />
    </div>
  );
}
