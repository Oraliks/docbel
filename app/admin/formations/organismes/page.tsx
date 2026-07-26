import type { Metadata } from "next";
import {
  listAdminOrgs,
  getAdminOrgStats,
} from "@/lib/formations/admin-org-queries";
import { isOrgStatus, type FormationOrgStatus } from "@/lib/formations/constants";
import { OrganismesClient } from "./organismes-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Organismes — Formations" };

/**
 * /admin/formations/organismes — file de validation des organismes de formation.
 * Le filtre statut est porté par l'URL (`?status=pending|active|…`) : il est
 * appliqué côté serveur, donc partageable et rechargeable.
 */
export default async function OrganismesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const activeStatus: FormationOrgStatus | null =
    status && isOrgStatus(status) ? status : null;

  const [rows, stats] = await Promise.all([
    listAdminOrgs(activeStatus ?? undefined),
    getAdminOrgStats(),
  ]);

  return (
    <OrganismesClient rows={rows} stats={stats} activeStatus={activeStatus} />
  );
}
