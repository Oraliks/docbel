import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { promises as fs } from "fs";
import path from "path";
import { auth } from "@/lib/auth";
import { PreavisEditor } from "@/components/admin/preavis-editor";

export default async function PreavisAdminPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session || role !== "admin") {
    notFound();
  }

  const filePath = path.join(process.cwd(), "lib", "notice-periods-official.json");
  const raw = await fs.readFile(filePath, "utf-8");
  const data = JSON.parse(raw);

  return (
    <div className="flex flex-col gap-6 py-6 px-4 lg:px-6">
      <PreavisEditor initialData={data} />
    </div>
  );
}
