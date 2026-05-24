import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { CommissionsParitairesPage } from "@/components/docbel/commissions-paritaires-page";
import { DisabledToolView } from "../[slug]/disabled-tool-view";

export const metadata: Metadata = {
  title: "Commissions paritaires belges",
  description:
    "Liste officielle des commissions paritaires (CP) et sous-commissions belges, avec recherche par code, numéro ou secteur.",
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CommissionsParitairesRoute() {
  const dbTool = await prisma.tool.findUnique({
    where: { slug: "commissions-paritaires" },
    select: { name: true, active: true },
  });
  if (dbTool && dbTool.active === false) {
    return <DisabledToolView toolName={dbTool.name} />;
  }
  return <CommissionsParitairesPage />;
}
