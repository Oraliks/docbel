import { PdfFormEditor } from "@/components/admin/pdf-forms/pdf-form-editor";

export const dynamic = "force-dynamic";

export default async function PdfFormEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PdfFormEditor formId={id} />;
}
