import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { getActiveBaremeData } from "@/lib/baremes/getActiveBaremeData";
import { getC1BaremeThresholds } from "@/lib/baremes/c1-thresholds";
import { requirePartnerOrAdminAuth } from "@/lib/auth-check";
import { prisma } from "@/lib/prisma";

import { FamilySituationVerifierClient } from "./verifier-client";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("public.pro");
  return { title: t("article110MetaTitle"), description: t("article110MetaDescription") };
}

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function FamilySituationVerifierPage() {
  const auth = await requirePartnerOrAdminAuth();
  if (!auth.isAuthorized) notFound();
  const thresholds = getC1BaremeThresholds(await getActiveBaremeData());
  const lookup = await prisma.lookupTable.findFirst({
    where: { slug: "s04-s36-article-indemnisation" },
    select: { entries: { where: { code: { startsWith: "110&" } }, orderBy: { code: "asc" }, take: 50, select: { code: true, labelFr: true } } },
  });
  return (
    <div className="px-4 py-6 lg:px-6">
      <FamilySituationVerifierClient thresholds={thresholds} officialOnemOptions={lookup?.entries ?? []} />
    </div>
  );
}
