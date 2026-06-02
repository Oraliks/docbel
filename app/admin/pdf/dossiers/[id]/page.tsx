import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  BundleEditor,
  type AvailablePdfForm,
  type BundleEditorData,
  type BundleEditorItem,
} from "@/components/admin/documents/bundle-editor";
import type { BundleCondition } from "@/lib/bundles/conditions";
import type { PdfFormField } from "@/lib/pdf-forms/types";

export const dynamic = "force-dynamic";

export default async function EditBundlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [bundle, pdfForms] = await Promise.all([
    prisma.documentBundle.findUnique({
      where: { id },
      include: {
        items: {
          orderBy: { order: "asc" },
          include: {
            pdfForm: { select: { id: true, slug: true, title: true, issuer: true } },
          },
        },
      },
    }),
    prisma.pdfForm.findMany({
      where: { status: "published" },
      select: { id: true, slug: true, title: true, issuer: true, fields: true },
      orderBy: { title: "asc" },
    }),
  ]);

  if (!bundle) notFound();

  const availablePdfForms: AvailablePdfForm[] = pdfForms.map((p) => ({
    id: p.id,
    slug: p.slug,
    title: p.title,
    issuer: p.issuer,
  }));

  // Schémas par PdfForm pour l'éditeur de conditions cross-form.
  const templateSchemas: Record<
    string,
    { id: string; label: string; type: string; options?: { value: string; label: string }[] }[]
  > = {};
  for (const p of pdfForms) {
    const fields = (p.fields as unknown as PdfFormField[]) || [];
    templateSchemas[p.id] = fields.map((f) => ({
      id: f.id,
      label: f.label?.fr || f.label?.nl || f.label?.de || f.id,
      type: f.type,
      options: f.options?.map((o) => ({
        value: o.value,
        label: o.label?.fr || o.label?.nl || o.label?.de || o.value,
      })),
    }));
  }

  const items: BundleEditorItem[] = bundle.items.map((it) => ({
    id: it.id,
    templateId: null,
    pdfFormId: it.pdfFormId,
    order: it.order,
    required: it.required,
    condition: (it.condition as unknown as BundleCondition) ?? null,
    template: null,
    pdfForm: it.pdfForm
      ? {
          id: it.pdfForm.id,
          slug: it.pdfForm.slug,
          title: it.pdfForm.title,
          issuer: it.pdfForm.issuer,
        }
      : null,
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
    <div className="flex flex-1 flex-col gap-6 px-4 py-6 lg:px-6">
      <BundleEditor
        initial={initial}
        availableTemplates={[]}
        availablePdfForms={availablePdfForms}
        templateSchemas={templateSchemas}
      />
    </div>
  );
}
