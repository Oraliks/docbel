import { prisma } from "@/lib/prisma";
import {
  BundleEditor,
  type AvailablePdfForm,
  type AvailableTemplate,
} from "@/components/admin/documents/bundle-editor";
import { DocumentField } from "@/lib/documents/types";
import type { PdfFormField } from "@/lib/pdf-forms/types";

export const dynamic = "force-dynamic";

export default async function NewBundlePage() {
  const [templates, pdfForms] = await Promise.all([
    prisma.documentTemplate.findMany({
      where: { status: "published" },
      include: {
        tool: { select: { id: true, name: true, slug: true } },
        organisme: { select: { id: true, shortName: true, color: true } },
      },
      orderBy: { tool: { name: "asc" } },
    }),
    prisma.pdfForm.findMany({
      where: { status: "published" },
      select: { id: true, slug: true, title: true, issuer: true, fields: true },
      orderBy: { title: "asc" },
    }),
  ]);

  const availableTemplates: AvailableTemplate[] = templates.map((t) => ({
    id: t.id,
    toolId: t.tool.id,
    toolName: t.tool.name,
    toolSlug: t.tool.slug,
    organisme: t.organisme,
  }));

  const availablePdfForms: AvailablePdfForm[] = pdfForms.map((p) => ({
    id: p.id,
    slug: p.slug,
    title: p.title,
    issuer: p.issuer,
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

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-6 lg:px-6">
      <BundleEditor
        initial={null}
        availableTemplates={availableTemplates}
        availablePdfForms={availablePdfForms}
        templateSchemas={templateSchemas}
      />
    </div>
  );
}
