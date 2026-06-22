/// Dashboard analytics du Decision Builder (admin). Funnel d'orientation,
/// demande par dossier (dont « orpheline »), recherches sans résultat,
/// activité admin. Auth portée par app/admin/layout.tsx.

import { getTranslations } from "next-intl/server";
import { getDecisionAnalytics } from "@/lib/decision-builder/analytics-queries";
import { AnalyticsDashboard } from "@/components/decision-builder/analytics-dashboard";

export const dynamic = "force-dynamic";

export default async function DecisionAnalyticsPage() {
  const t = await getTranslations("admin.decisionTrees");
  const data = await getDecisionAnalytics(30).catch(() => null);

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-6 lg:px-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          {t("analyticsTitle")}
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          {t("analyticsDescription")}
        </p>
      </div>
      {data ? (
        <AnalyticsDashboard data={data} />
      ) : (
        <p className="text-sm text-muted-foreground">
          {t("analyticsUnavailable")}
        </p>
      )}
    </div>
  );
}
