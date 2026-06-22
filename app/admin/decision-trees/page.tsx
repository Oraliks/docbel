/// Liste des arbres d'orientation (Decision Builder). L'auth admin est portée
/// par app/admin/layout.tsx.

import { getTranslations } from "next-intl/server";
import { DecisionTreesList } from "@/components/decision-builder/decision-trees-list";

export const dynamic = "force-dynamic";

export default async function DecisionTreesPage() {
  const t = await getTranslations("admin.decisionTrees");
  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-6 lg:px-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          {t("description")}
        </p>
      </div>
      <DecisionTreesList />
    </div>
  );
}
