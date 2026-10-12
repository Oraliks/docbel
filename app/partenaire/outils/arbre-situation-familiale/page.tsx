import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { requirePartnerOrAdminAuth } from "@/lib/auth-check";
import { FamilySituationTree } from "./family-situation-tree";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("public.pro.familySituationTree");
  return { title: t("metaTitle"), description: t("metaDescription") };
}

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Prototype de lecture isolé du vérificateur et de tout moteur métier. */
export default async function FamilySituationTreePage() {
  const auth = await requirePartnerOrAdminAuth();
  if (!auth.isAuthorized) notFound();

  return (
    <div className="px-4 py-6 lg:px-6">
      <FamilySituationTree />
    </div>
  );
}
