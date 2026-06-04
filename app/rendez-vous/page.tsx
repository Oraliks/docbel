import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  requirePartnerOrAdminAuth,
  requireRdvHistoryAccess,
} from "@/lib/auth-check";
import { listOrganizations } from "@/lib/partner-domains";
import { RendezVousExportClient } from "./rendez-vous-client";

export const metadata: Metadata = {
  title: "Rendez-vous → Outlook (.ics) | DocBel",
  description:
    "Convertissez une liste de rendez-vous collée (format FGTB) en fichier calendrier Outlook (.ics).",
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Page outil « Rendez-vous → .ics ». Réservée aux PARTENAIRES (dont la FGTB) et
 * aux ADMINS.
 *
 * Comme pour le Lookup ONEM, on garde l'URL neutre (`/rendez-vous`) et on
 * répond `notFound()` aux non-autorisés : l'URL ne doit pas trahir le rôle
 * requis. La route `/api/export-ics` applique la même garde côté serveur.
 */
export default async function RendezVousPage() {
  const base = await requirePartnerOrAdminAuth();
  if (!base.isAuthorized) {
    notFound();
  }

  // Accès à l'historique = responsables / personnes autorisées / admins.
  const history = await requireRdvHistoryAccess();
  const canViewHistory = history.isAuthorized;

  // Les admins choisissent l'organisation cible (l'historique étant partagé
  // par organisation) ; on leur fournit donc la liste des organisations.
  let orgOptions: string[] = [];
  if (base.user.isAdmin) {
    const orgs = await listOrganizations("partenaire");
    orgOptions = orgs.map((o) => o.organizationName);
  }

  return (
    <div className="px-4 py-6 lg:px-6">
      <RendezVousExportClient
        isAdmin={base.user.isAdmin}
        partnerOrganization={base.user.partnerOrganization}
        orgOptions={orgOptions}
        canViewHistory={canViewHistory}
      />
    </div>
  );
}
