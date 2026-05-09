import type { Metadata } from "next";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SpaceLanding } from "@/components/docbel/space-landing";
import { PartnerDashboard } from "@/components/docbel/partner-dashboard";

export const metadata: Metadata = {
  title: "Espace Partenaire | DocBel",
  description:
    "Espace partenaire DocBel : CPAS, syndicats, mutuelles. Suivi de dossiers et tableau de bord.",
};

export const dynamic = "force-dynamic";

export default async function PartenaireRoute() {
  const session = await auth.api
    .getSession({ headers: await headers() })
    .catch(() => null);

  if (session?.user) {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, role: true, partnerOrganization: true },
    });

    if (
      user?.role === "partner" &&
      user.partnerOrganization
    ) {
      const [colleagues, domains] = await Promise.all([
        prisma.user.findMany({
          where: {
            role: "partner",
            partnerOrganization: user.partnerOrganization,
          },
          select: {
            id: true,
            name: true,
            email: true,
            status: true,
            emailVerified: true,
            lastLoginAt: true,
            createdAt: true,
          },
          orderBy: { lastLoginAt: { sort: "desc", nulls: "last" } },
        }),
        prisma.partnerDomain.findMany({
          where: { organizationName: user.partnerOrganization },
          select: { domain: true, isActive: true },
          orderBy: { domain: "asc" },
        }),
      ]);

      return (
        <PartnerDashboard
          organizationName={user.partnerOrganization}
          currentUserId={user.id}
          colleagues={colleagues}
          domains={domains}
        />
      );
    }
  }

  return <SpaceLanding audience="partenaire" />;
}
