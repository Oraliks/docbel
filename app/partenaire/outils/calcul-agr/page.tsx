import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { requirePartnerOrAdminAuth } from "@/lib/auth-check";
import { CalculAgrClient } from "./calcul-agr-client";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("public.pro");
  return {
    title: t("agrMetaTitle"),
    description: t("agrMetaDesc"),
  };
}

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Outil « Calcul AGR ». Réservé aux PARTENAIRES FGTB et aux ADMINS — même
 * politique que l'outil fgtb-planning. La route /api/partenaire/calcul-agr/parse
 * applique la même garde côté serveur.
 */
export default async function CalculAgrPage() {
  const base = await requirePartnerOrAdminAuth();
  if (!base.isAuthorized) {
    notFound();
  }
  if (!base.user.isAdmin && !/fgtb/i.test(base.user.partnerOrganization ?? "")) {
    notFound();
  }

  return (
    <div className="px-4 py-6 lg:px-6">
      <CalculAgrClient />
    </div>
  );
}
