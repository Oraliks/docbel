import { prisma } from "@/lib/prisma";
import { ToolsListView } from "@/components/admin/tools-list-view";

export default async function OutilsPage() {
  const tools = await prisma.tool.findMany({
    include: {
      section: true,
    },
    orderBy: {
      order: "asc",
    },
  });

  return (
    <div className="flex flex-col gap-6 py-6 px-4 lg:px-6">
      <ToolsListView tools={tools} />
    </div>
  );
}
