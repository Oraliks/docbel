import {
  listExistingOrganizationNames,
  listOrganizations,
} from "@/lib/partner-domains";
import { PartnerOverviewShell } from "@/components/admin/partenaires/overview/partner-overview-shell";

/**
 * Page d'overview admin des organisations partenaires (refonte 2026-05).
 *
 * Server component minimaliste : charge les organisations + noms distincts
 * depuis Prisma, sérialise les dates pour traverser la frontière server →
 * client, puis délègue tout l'UI à `<PartnerOverviewShell />`.
 *
 * Auth + role check : assurés par app/admin/layout.tsx.
 *
 * Pages adjacentes (boutons en header du shell) :
 *   - /admin/partenaires/stats : vue stats détaillée
 *   - /admin/partenaires/email : configuration de l'email d'invitation
 *
 * Toutes les mutations passent par les endpoints API existants
 * (`/api/admin/partner-domains/*`, `/api/admin/partner-users/*`,
 * `/api/admin/partner-organizations/rename`).
 */
export const dynamic = "force-dynamic";

export default async function PartenairesAdminPage() {
  const [initialOrganizations, existingOrgNames] = await Promise.all([
    listOrganizations(),
    listExistingOrganizationNames(),
  ]);

  // Sérialisation des dates (Date → ISO string) pour passer au client.
  const serialized = initialOrganizations.map((org) => ({
    ...org,
    domains: org.domains.map((d) => ({
      ...d,
      createdAt: d.createdAt.toISOString(),
    })),
    users: org.users.map((u) => ({
      ...u,
      createdAt: u.createdAt.toISOString(),
      lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
    })),
  }));

  return (
    <PartnerOverviewShell
      initialOrganizations={serialized}
      existingOrganizationNames={existingOrgNames}
    />
  );
}
