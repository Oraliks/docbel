import { getTranslations } from "next-intl/server";
import { CommissionsManager } from "@/components/admin/commissions-manager";

export const dynamic = "force-dynamic";

export default async function CommissionsAdminPage() {
  const t = await getTranslations("admin.commissions");
  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-6 lg:px-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground mt-2">
          {t("description")}
        </p>
      </div>
      <CommissionsManager />
    </div>
  );
}
