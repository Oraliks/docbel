import { prisma } from "@/lib/prisma";
import { NewTemplateForm } from "@/components/admin/documents/new-template-form";

export const dynamic = "force-dynamic";

export default async function NewDocumentPage() {
  const sections = await prisma.toolSection.findMany({
    select: { id: true, name: true },
    orderBy: { order: "asc" },
  });

  return (
    <div className="flex flex-col gap-6 py-6 px-4 lg:px-6">
      <NewTemplateForm sections={sections} />
    </div>
  );
}
