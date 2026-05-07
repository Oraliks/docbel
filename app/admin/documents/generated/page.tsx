import { GeneratedDocumentsView } from "@/components/admin/documents/generated-documents-view";

export const dynamic = "force-dynamic";

export default function GeneratedDocumentsPage() {
  return (
    <div className="flex flex-col gap-6 py-6 px-4 lg:px-6">
      <GeneratedDocumentsView />
    </div>
  );
}
