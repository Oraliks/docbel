// Contrôle d'accès aux tenants de booking. Trois sources d'autorisation :
//   1. admin → owner partout
//   2. membre explicite (BookingTenantMember) → son rôle
//   3. pont partenaire : User.partnerOrganization === tenant.partnerOrganization
//      (les responsables `isOrgManager` deviennent owner, les autres agent)
// Aucune table de jonction n'est requise pour les organismes chômage existants.

import type { BookingTenant } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type EffectiveRole = "owner" | "manager" | "agent" | null;

export interface TenantAccess {
  tenant: BookingTenant | null;
  role: EffectiveRole;
}

export async function tenantAccess(
  userId: string,
  userRole: string,
  tenantId: string,
): Promise<TenantAccess> {
  const tenant = await prisma.bookingTenant.findUnique({
    where: { id: tenantId },
  });
  if (!tenant) return { tenant: null, role: null };

  if (userRole === "admin") return { tenant, role: "owner" };

  const member = await prisma.bookingTenantMember.findUnique({
    where: { tenantId_userId: { tenantId, userId } },
  });
  if (member) return { tenant, role: member.role as EffectiveRole };

  if (userRole === "partner" && tenant.partnerOrganization) {
    const u = await prisma.user.findUnique({
      where: { id: userId },
      select: { partnerOrganization: true, isOrgManager: true },
    });
    if (u?.partnerOrganization === tenant.partnerOrganization) {
      return { tenant, role: u.isOrgManager ? "owner" : "agent" };
    }
  }

  return { tenant, role: null };
}

/** Liste les tenants qu'un utilisateur peut gérer. */
export async function listAccessibleTenants(
  userId: string,
  userRole: string,
): Promise<BookingTenant[]> {
  if (userRole === "admin") {
    return prisma.bookingTenant.findMany({ orderBy: { name: "asc" } });
  }

  const memberships = await prisma.bookingTenantMember.findMany({
    where: { userId },
    select: { tenantId: true },
  });
  const ids = new Set(memberships.map((m) => m.tenantId));

  if (userRole === "partner") {
    const u = await prisma.user.findUnique({
      where: { id: userId },
      select: { partnerOrganization: true },
    });
    if (u?.partnerOrganization) {
      const orgTenants = await prisma.bookingTenant.findMany({
        where: { partnerOrganization: u.partnerOrganization },
        select: { id: true },
      });
      for (const t of orgTenants) ids.add(t.id);
    }
  }

  if (ids.size === 0) return [];
  return prisma.bookingTenant.findMany({
    where: { id: { in: [...ids] } },
    orderBy: { name: "asc" },
  });
}

export const canConfigure = (r: EffectiveRole): boolean => r === "owner";
export const canManageTeam = (r: EffectiveRole): boolean => r === "owner";
export const canApprove = (r: EffectiveRole): boolean =>
  r === "owner" || r === "manager" || r === "agent";
