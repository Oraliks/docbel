// Garde commune aux routes équipe : authentifie (partenaire/admin) puis résout
// l'accès au tenant et le niveau requis.

import { NextResponse } from "next/server";
import type { BookingTenant } from "@prisma/client";

import { requireBookingActorAuth } from "@/lib/auth-check";
import {
  canApprove,
  canConfigure,
  canManageTeam,
  tenantAccess,
  type EffectiveRole,
} from "./access";

const json = { "Content-Type": "application/json; charset=utf-8" };

export type GuardLevel = "view" | "approve" | "config" | "team";

export type GuardResult =
  | {
      ok: true;
      userId: string;
      userName: string;
      userRole: string;
      tenant: BookingTenant;
      role: EffectiveRole;
    }
  | { ok: false; response: NextResponse };

export async function guardTenant(
  tenantId: string,
  level: GuardLevel = "view",
): Promise<GuardResult> {
  const auth = await requireBookingActorAuth();
  if (!auth.isAuthorized) return { ok: false, response: auth.error };

  const { tenant, role } = await tenantAccess(auth.user.id, auth.user.role, tenantId);
  if (!tenant || !role) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Accès refusé" }, { status: 403, headers: json }),
    };
  }

  const allowed =
    level === "view"
      ? true
      : level === "approve"
        ? canApprove(role)
        : level === "team"
          ? canManageTeam(role)
          : canConfigure(role);

  if (!allowed) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Droits insuffisants" },
        { status: 403, headers: json },
      ),
    };
  }

  return {
    ok: true,
    userId: auth.user.id,
    userName: auth.user.name,
    userRole: auth.user.role,
    tenant,
    role,
  };
}
