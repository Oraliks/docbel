import Link from "next/link";
import { MailIcon } from "lucide-react";
import {
  listExistingOrganizationNames,
  listOrganizations,
} from "@/lib/partner-domains";
import { PartnerDomainsManager } from "@/components/admin/partner-domains-manager";

export const dynamic = "force-dynamic";

export default async function PartnerDomainsAdminPage() {
  const [initialOrganizations, existingOrgNames] = await Promise.all([
    listOrganizations(),
    listExistingOrganizationNames(),
  ]);

  const serializedOrgs = initialOrganizations.map((org) => ({
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
    <div className="p-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Partenaires
          </h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Gérez les organisations partenaires et leurs domaines email
            autorisés. Plusieurs domaines peuvent appartenir à la même
            organisation (ex : <code>fgtb.be</code> et <code>abvv.be</code>).
            Cliquez sur une organisation pour voir ses utilisateurs inscrits.
          </p>
        </div>
        <Link
          href="/admin/partenaires/email"
          className="inline-flex items-center gap-1.5 rounded-md border bg-background px-3 py-2 text-sm font-medium hover:bg-muted"
        >
          <MailIcon className="size-4" />
          Email d&apos;invitation
        </Link>
      </div>
      <PartnerDomainsManager
        initialOrganizations={serializedOrgs}
        existingOrganizationNames={existingOrgNames}
      />
    </div>
  );
}
