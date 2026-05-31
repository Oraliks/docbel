import type { Metadata } from "next";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SpaceLanding } from "@/components/docbel/space-landing";
import { EmployerDashboard } from "@/components/docbel/employer-dashboard";
import { filterByAudience, getPublicCatalog } from "@/lib/outils-catalog";

export const metadata: Metadata = {
  title: "Espace Employeur | DocBel",
  description:
    "Outils RH pour employeurs belges : C4, attestations sociales, calcul de préavis.",
};

export const dynamic = "force-dynamic";

export default async function EmployeurRoute() {
  const session = await auth.api
    .getSession({ headers: await headers() })
    .catch(() => null);

  // Employeur connecté → tableau de bord employeur (analogue à /partenaire).
  if (session?.user) {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, role: true, partnerOrganization: true },
    });

    if (user?.role === "employer" && user.partnerOrganization) {
      const [members, entries] = await Promise.all([
        prisma.user.findMany({
          where: {
            role: "employer",
            partnerOrganization: user.partnerOrganization,
          },
          select: {
            id: true,
            name: true,
            email: true,
            status: true,
            lastLoginAt: true,
          },
          orderBy: { lastLoginAt: { sort: "desc", nulls: "last" } },
        }),
        prisma.partnerDomain.findMany({
          where: { organizationName: user.partnerOrganization },
          select: { kind: true, domain: true, email: true, isActive: true },
          orderBy: { createdAt: "asc" },
        }),
      ]);

      const accesses = entries
        .map((e) => ({
          label: e.kind === "email" ? (e.email ?? "") : `@${e.domain ?? ""}`,
          isActive: e.isActive,
        }))
        .filter((a) => a.label && a.label !== "@");

      return (
        <EmployerDashboard
          organizationName={user.partnerOrganization}
          currentUserId={user.id}
          members={members}
          accesses={accesses}
        />
      );
    }
  }

  // Sinon (anonyme, citoyen, partenaire) → vitrine publique de l'espace employeur.
  const all = await getPublicCatalog();
  const tools = filterByAudience(all, "employeur");
  return <SpaceLanding audience="employeur" tools={tools} />;
}
