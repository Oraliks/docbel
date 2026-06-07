import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { requirePartnerOrAdminAuth } from "@/lib/auth-check";
import { CalculAgrClient } from "./calcul-agr-client";

export const metadata: Metadata = {
  title: "Calcul AGR | DocBel",
  description:
    "Calculez l'Allocation de Garantie de Revenus à partir d'un WECH 506 : upload de la DRS, calcul automatique, cumul jusqu'à 4 occupations.",
};

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
