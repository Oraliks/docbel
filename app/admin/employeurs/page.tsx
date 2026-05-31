import { listExistingOrganizationNames, listOrganizations } from "@/lib/partner-domains";
import { PartnerOverviewShell } from "@/components/admin/partenaires/overview/partner-overview-shell";

/**
 * Page d'overview admin des EMPLOYEURS (split partenaires/employeurs,
 * 2026-05). Symétrique de /admin/partenaires mais filtrée sur le segment
 * "employeur" : n'affiche QUE les entrées d'allowlist segment="employeur" et
 * les utilisateurs de rôle "employer".
 *
 * Réutilise le même shell que /admin/partenaires (`<PartnerOverviewShell />`)
 * avec des props qui :
 *   - retitrent en « Espace Employeurs » ;
 *   - masquent le verrou de facturation (toggle GLOBAL → seulement côté
 *     partenaires) ;
 *   - masquent l'export CSV (l'endpoint actuel ne sort que les partenaires) ;
 *   - retirent les liens stats / email d'invitation (sous-pages partenaires) ;
 *   - pré-sélectionnent le segment "employeur" dans le dialog de création.
 *
 * Auth + role check : assurés par app/admin/layout.tsx.
 */
export const dynamic = "force-dynamic";

export default async function EmployeursAdminPage() {
  const [initialOrganizations, existingOrgNames] = await Promise.all([
    listOrganizations("employeur"),
    listExistingOrganizationNames(),
  ]);

  // Sérialisation des dates (Date → ISO string) pour passer au client.
  const serialized = initialOrganizations.map((org) => ({
    ...org,
    domains: org.domains.map((d) => ({
      id: d.id,
      kind: (d.kind === "email" ? "email" : "domain") as "domain" | "email",
      domain: d.domain,
      email: d.email,
      segment: (d.segment === "employeur" ? "employeur" : "partenaire") as
        | "partenaire"
        | "employeur",
      partnerType: d.partnerType,
      notes: d.notes,
      isTest: d.isTest,
      isActive: d.isActive,
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
      // billingEnabled non pertinent ici (verrou global masqué via showBilling).
      billingEnabled={false}
      title="Espace Employeurs"
      showBilling={false}
      showExport={true}
      exportHref="/api/admin/partner-users/export?segment=employeur"
      headerLinks={[
        { href: "/admin/employeurs/stats", label: "Statistiques", icon: "stats" },
        { href: "/admin/employeurs/email", label: "Email d'invitation", icon: "mail" },
      ]}
      createDefaultSegment="employeur"
    />
  );
}
