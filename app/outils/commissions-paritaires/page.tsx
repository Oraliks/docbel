import type { Metadata } from "next";
import { getLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { localizeRecord } from "@/lib/i18n/content";
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
  const dbToolRow = await prisma.tool.findUnique({
    where: { slug: "commissions-paritaires" },
    select: { id: true, name: true, active: true },
  });
  // Traduction du nom (DisabledToolView) : id + name requis par le resolver,
  // no-op en FR, fallback FR sinon.
  const locale = await getLocale();
  const dbTool = dbToolRow
    ? await localizeRecord("Tool", dbToolRow, ["name"], locale)
    : null;
  if (dbTool && dbTool.active === false) {
    return <DisabledToolView toolName={dbTool.name} />;
  }
  return <CommissionsParitairesPage />;
}
