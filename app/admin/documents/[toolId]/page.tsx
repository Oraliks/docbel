import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { TemplateEditor } from "@/components/admin/documents/template-editor";
import { DocumentField } from "@/lib/documents/types";

export const dynamic = "force-dynamic";

export default async function EditDocumentTemplatePage({
  params,
}: {
  params: Promise<{ toolId: string }>;
}) {
  const { toolId } = await params;

  const [tool, organismes, presets] = await Promise.all([
    prisma.tool.findUnique({
      where: { id: toolId },
      include: {
        documentTemplate: {
          include: {
            sourceFile: { select: { id: true, name: true, fileType: true, sha256: true } },
            organisme: { select: { id: true, code: true, name: true, shortName: true, color: true } },
          },
        },
        section: { select: { id: true, name: true } },
      },
    }),
    prisma.organisme.findMany({
      where: { active: true },
      select: { id: true, code: true, name: true, shortName: true, color: true, type: true },
      orderBy: [{ order: "asc" }, { name: "asc" }],
    }),
    prisma.fieldValidationPreset.findMany({
      orderBy: [{ category: "asc" }, { name: "asc" }],
    }),
  ]);

  if (!tool || !tool.documentTemplate) {
    notFound();
  }

  const t = tool.documentTemplate;
  const initial = {
    id: t.id,
    toolId: t.toolId,
    sourceType: t.sourceType,
    schema: (t.schema as unknown as DocumentField[]) || [],
    rgpdNotice: t.rgpdNotice,
    retentionDays: t.retentionDays,
    outputFilenameTpl: t.outputFilenameTpl,
    status: t.status,
    version: t.version,
    organismeId: t.organismeId,
    effectiveDate: t.effectiveDate?.toISOString().slice(0, 10) ?? null,
    expiresAt: t.expiresAt?.toISOString().slice(0, 10) ?? null,
    officialRef: t.officialRef,
    requiresSignature: t.requiresSignature,
    signaturePosition: t.signaturePosition as { page: number; x: number; y: number; w: number; h: number } | null,
    sourceFile: t.sourceFile,
    organisme: t.organisme,
    tool: {
      id: tool.id,
      name: tool.name,
      slug: tool.slug,
      sectionName: tool.section.name,
    },
  };

  const presetsSerialized = presets.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    category: p.category,
    fieldType: p.fieldType,
    regex: p.regex,
    regexFlags: p.regexFlags,
    minLength: p.minLength,
    maxLength: p.maxLength,
    minValue: p.minValue,
    maxValue: p.maxValue,
    minDate: p.minDate,
    maxDate: p.maxDate,
    belgianType: p.belgianType,
    errorMsg: p.errorMsg,
    errorMsgNl: p.errorMsgNl,
    helpText: p.helpText,
    helpTextNl: p.helpTextNl,
    placeholder: p.placeholder,
    placeholderNl: p.placeholderNl,
    // Bibliothèque canonique (migration 13)
    defaultLabel: p.defaultLabel,
    defaultWidth: p.defaultWidth,
    defaultHeight: p.defaultHeight,
    defaultValue: p.defaultValue,
    defaultOptions: p.defaultOptions,
    popular: p.popular,
    icon: p.icon,
  }));

  return (
    <div className="flex flex-col gap-6 py-6 px-4 lg:px-6">
      <TemplateEditor initial={initial} organismes={organismes} presets={presetsSerialized} />
    </div>
  );
}
