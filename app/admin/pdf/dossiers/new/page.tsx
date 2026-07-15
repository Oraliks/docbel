import { prisma } from "@/lib/prisma";
import {
  BundleEditor,
  type AvailablePdfForm,
} from "@/components/admin/documents/bundle-editor";
import type { PdfFormField } from "@/lib/pdf-forms/types";

export const dynamic = "force-dynamic";

export default async function NewBundlePage() {
  const pdfForms = await prisma.pdfForm.findMany({
    where: { status: "published" },
    select: {
      id: true,
      slug: true,
      title: true,
      issuer: true,
      status: true,
      active: true,
      fields: true,
    },
    orderBy: { title: "asc" },
  });

  const availablePdfForms: AvailablePdfForm[] = pdfForms.map((p) => ({
    id: p.id,
    slug: p.slug,
    title: p.title,
    issuer: p.issuer,
    status: p.status,
    active: p.active,
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

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-6 lg:px-6">
      <BundleEditor
        initial={null}
        availableTemplates={[]}
        availablePdfForms={availablePdfForms}
        templateSchemas={templateSchemas}
      />
    </div>
  );
}
