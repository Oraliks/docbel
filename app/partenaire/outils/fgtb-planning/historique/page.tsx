import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { requireRdvHistoryAccess } from "@/lib/auth-check";
import { listOrganizations } from "@/lib/partner-domains";
import { RdvHistoryClient } from "./historique-client";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("public.pro");
  return {
    title: t("rdvHistMetaTitle"),
    description: t("rdvHistMetaDescription"),
  };
}

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Page « Historique des rendez-vous ». Réservée aux RESPONSABLES du service
 * partenaire, aux personnes explicitement autorisées, et aux ADMINS.
 *
 * Comme les autres outils partenaires, on répond `notFound()` aux non-autorisés
 * pour ne pas trahir l'existence de la page. Les admins choisissent
 * l'organisation à consulter ; les partenaires voient la leur.
 */
export default async function RendezVousHistoriquePage() {
  const auth = await requireRdvHistoryAccess();
  if (!auth.isAuthorized) {
    notFound();
  }
  const { user } = auth;

  let orgOptions: string[] = [];
  if (user.isAdmin) {
    const orgs = await listOrganizations("partenaire");
    orgOptions = orgs.map((o) => o.organizationName);
  }

  return (
    <div className="px-4 py-6 lg:px-6">
      <RdvHistoryClient
        isAdmin={user.isAdmin}
        defaultOrg={user.partnerOrganization}
        orgOptions={orgOptions}
      />
    </div>
  );
}
