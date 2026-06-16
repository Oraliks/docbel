/**
 * Garde commune aux routes API d'organisation du module Formations.
 * Authentifie un acteur pro (partenaire/employeur/admin) puis résout l'accès et
 * les capacités sur l'organisation. Toute mutation doit aussi appeler
 * ensureWriteAllowed() (comptes démo / impersonation lecture seule).
 */
import "server-only";
import { NextResponse } from "next/server";
import type { FormationOrganization, OrganizationTrainingPermission } from "@prisma/client";

import { requireBookingActorAuth } from "@/lib/auth-check";
import {
  formationOrgAccess,
  type EffectiveOrgRole,
  type OrgCapabilities,
} from "./access";

const json = { "Content-Type": "application/json; charset=utf-8" };

export type FormationGuardResult =
  | {
      ok: true;
      userId: string;
      userName: string;
      userRole: string;
      isAdmin: boolean;
      org: FormationOrganization;
      role: EffectiveOrgRole;
      permission: OrganizationTrainingPermission | null;
      can: OrgCapabilities;
    }
  | { ok: false; response: NextResponse };

/**
 * Garde une organisation : l'acteur doit être membre (rôle != null) ou admin.
 * Les capacités fines sont renvoyées dans `can` — le handler vérifie ensuite
 * la capacité requise (ex: `if (!guard.can.create) ...`).
 */
export async function guardFormationOrg(
  organizationId: string,
): Promise<FormationGuardResult> {
  const auth = await requireBookingActorAuth();
  if (!auth.isAuthorized) return { ok: false, response: auth.error };

  const access = await formationOrgAccess(auth.user.id, auth.user.role, organizationId);
  if (!access.org) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Organisation introuvable" },
        { status: 404, headers: json },
      ),
    };
  }
  if (!access.role) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Accès refusé à cette organisation" },
        { status: 403, headers: json },
      ),
    };
  }

  return {
    ok: true,
    userId: auth.user.id,
    userName: auth.user.name,
    userRole: auth.user.role,
    isAdmin: access.isAdmin,
    org: access.org,
    role: access.role,
    permission: access.permission,
    can: access.capabilities,
  };
}

/** Réponse 403 standard pour une capacité manquante. */
export function forbidden(message = "Droits insuffisants"): NextResponse {
  return NextResponse.json({ error: message }, { status: 403, headers: json });
}
