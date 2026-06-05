import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { requireRdvHistoryAccess } from "@/lib/auth-check";
import { listOrganizations } from "@/lib/partner-domains";
import { RdvHistoryClient } from "./historique-client";

export const metadata: Metadata = {
  title: "Historique des rendez-vous | DocBel",
  description:
    "Consultation de l'historique des rendez-vous traités par le service.",
};

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
