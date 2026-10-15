import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { requirePartnerOrAdminAuth } from "@/lib/auth-check";
import { getActiveBaremeData } from "@/lib/baremes/getActiveBaremeData";
import { getC1BaremeThresholds } from "@/lib/baremes/c1-thresholds";
import { FamilySituationTree } from "./family-situation-tree";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("public.pro.familySituationTree");
  return { title: t("metaTitle"), description: t("metaDescription") };
}

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function FamilySituationTreePage() {
  const auth = await requirePartnerOrAdminAuth();
  if (!auth.isAuthorized) notFound();
  const thresholds = getC1BaremeThresholds(await getActiveBaremeData());

  return (
    <div className="px-4 py-6 lg:px-6">
      <FamilySituationTree thresholds={thresholds} />
    </div>
  );
}
