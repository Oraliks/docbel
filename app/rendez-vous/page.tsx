import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { requirePartnerOrAdminAuth } from "@/lib/auth-check";
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
  const { isAuthorized } = await requirePartnerOrAdminAuth();
  if (!isAuthorized) {
    notFound();
  }

  return (
    <div className="px-4 py-6 lg:px-6">
      <RendezVousExportClient />
    </div>
  );
}
