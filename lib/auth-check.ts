import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma, withDbRetry } from "@/lib/prisma";
import { UserStatus } from "@prisma/client";

const jsonHeaders = { "Content-Type": "application/json; charset=utf-8" };

export type AuthorizedUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: UserStatus;
};

export type AdminAuthResult =
  | { isAuthorized: true; user: AuthorizedUser; error?: undefined }
  | { isAuthorized: false; error: NextResponse; user?: undefined };

export type PartnerAuthorizedUser = AuthorizedUser & {
  partnerOrganization: string | null;
  isAdmin: boolean;
};

export type PartnerAuthResult =
  | { isAuthorized: true; user: PartnerAuthorizedUser; error?: undefined }
  | { isAuthorized: false; error: NextResponse; user?: undefined };

export async function requireAdminAuth(): Promise<AdminAuthResult> {
  const headerList = await headers();
  const session = await withDbRetry(() =>
    auth.api.getSession({ headers: headerList })
  ).catch(() => null);

  if (!session?.user?.id) {
    return {
      isAuthorized: false,
      error: NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: jsonHeaders }
      ),
    };
  }

  const dbUser = await withDbRetry(() =>
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, name: true, email: true, role: true, status: true },
    })
  ).catch(() => null);

  if (!dbUser || dbUser.status !== UserStatus.active) {
    return {
      isAuthorized: false,
      error: NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: jsonHeaders }
      ),
    };
  }

  if (dbUser.role !== "admin") {
    return {
      isAuthorized: false,
      error: NextResponse.json(
        { error: "Forbidden - Admin access required" },
        { status: 403, headers: jsonHeaders }
      ),
    };
  }

  return { isAuthorized: true, user: dbUser };
}

/**
 * Helper interne : auth pour un espace professionnel (Partenaire OU Employeur).
 * Autorise :
 *   - les admins (role=admin, active) → accès complet
 *   - les comptes du rôle attendu, actifs, avec une organisation rattachée
 *     (role=`proRole` + partnerOrganization)
 *
 * Volontairement NON exporté : on expose des guards dédiés par segment
 * (`requirePartnerOrAdminAuth`, `requireEmployerOrAdminAuth`) afin de garder des
 * espaces séparés plutôt qu'un guard fourre-tout.
 */
async function requireProOrAdminAuth(
  proRole: "partner" | "employer",
  forbiddenMessage: string
): Promise<PartnerAuthResult> {
  const headerList = await headers();
  const session = await withDbRetry(() =>
    auth.api.getSession({ headers: headerList })
  ).catch(() => null);

  if (!session?.user?.id) {
    return {
      isAuthorized: false,
      error: NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: jsonHeaders }
      ),
    };
  }

  const dbUser = await withDbRetry(() =>
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        partnerOrganization: true,
      },
    })
  ).catch(() => null);

  if (!dbUser || dbUser.status !== UserStatus.active) {
    return {
      isAuthorized: false,
      error: NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: jsonHeaders }
      ),
    };
  }

  const isAdmin = dbUser.role === "admin";
  const isProWithOrg =
    dbUser.role === proRole && !!dbUser.partnerOrganization;

  if (!isAdmin && !isProWithOrg) {
    return {
      isAuthorized: false,
      error: NextResponse.json(
        { error: forbiddenMessage },
        { status: 403, headers: jsonHeaders }
      ),
    };
  }

  return {
    isAuthorized: true,
    user: {
      id: dbUser.id,
      name: dbUser.name,
      email: dbUser.email,
      role: dbUser.role,
      status: dbUser.status,
      partnerOrganization: dbUser.partnerOrganization,
      isAdmin,
    },
  };
}

/**
 * Auth pour les pages/routes "Espace Partenaire". Autorise :
 *   - les admins (role=admin, active) → accès complet
 *   - les partners avec une organisation rattachée (role=partner + partnerOrganization)
 *
 * STRICTEMENT réservé aux partenaires (les employeurs n'y ont PAS accès) — voir
 * `requireEmployerOrAdminAuth` pour l'espace employeur.
 *
 * Renvoie un AuthorizedUser enrichi avec `partnerOrganization` et `isAdmin` pour
 * que les routes/pages puissent adapter leur logique (ex: scoper les données par org
 * partenaire, ou exposer tout pour les admins).
 */
export async function requirePartnerOrAdminAuth(): Promise<PartnerAuthResult> {
  return requireProOrAdminAuth(
    "partner",
    "Forbidden - Partner or Admin access required"
  );
}

/**
 * Auth pour la plateforme de booking : autorise les utilisateurs PRO actifs
 * (admin, partner OU employer). L'accès à un tenant précis est ensuite décidé
 * par `tenantAccess()` (admin → owner ; membre explicite → son rôle ; partenaire
 * de l'organisation → owner/agent). Les employeurs accèdent uniquement aux
 * tenants où ils sont membres.
 */
export async function requireBookingActorAuth(): Promise<PartnerAuthResult> {
  const headerList = await headers();
  const session = await withDbRetry(() =>
    auth.api.getSession({ headers: headerList })
  ).catch(() => null);

  if (!session?.user?.id) {
    return {
      isAuthorized: false,
      error: NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: jsonHeaders }
      ),
    };
  }

  const dbUser = await withDbRetry(() =>
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        partnerOrganization: true,
      },
    })
  ).catch(() => null);

  if (!dbUser || dbUser.status !== UserStatus.active) {
    return {
      isAuthorized: false,
      error: NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: jsonHeaders }
      ),
    };
  }

  const isAdmin = dbUser.role === "admin";
  const allowed =
    isAdmin || dbUser.role === "partner" || dbUser.role === "employer";

  if (!allowed) {
    return {
      isAuthorized: false,
      error: NextResponse.json(
        { error: "Forbidden - Pro access required" },
        { status: 403, headers: jsonHeaders }
      ),
    };
  }

  return {
    isAuthorized: true,
    user: {
      id: dbUser.id,
      name: dbUser.name,
      email: dbUser.email,
      role: dbUser.role,
      status: dbUser.status,
      partnerOrganization: dbUser.partnerOrganization,
      isAdmin,
    },
  };
}

/**
 * Auth pour les pages/routes "Espace Employeur". Autorise :
 *   - les admins (role=admin, active) → accès complet
 *   - les employeurs avec une organisation rattachée (role=employer + partnerOrganization)
 *
 * STRICTEMENT réservé aux employeurs (les partenaires n'y ont PAS accès) — voir
 * `requirePartnerOrAdminAuth` pour l'espace partenaire.
 *
 * Même forme de retour que `requirePartnerOrAdminAuth` (`partnerOrganization` +
 * `isAdmin`) pour que les routes/pages employeur scopent leurs données par org.
 */
export async function requireEmployerOrAdminAuth(): Promise<PartnerAuthResult> {
  return requireProOrAdminAuth(
    "employer",
    "Forbidden - Employer or Admin access required"
  );
}

export type RdvHistoryUser = AuthorizedUser & {
  partnerOrganization: string | null;
  isAdmin: boolean;
  isOrgManager: boolean;
  canViewRdvHistory: boolean;
};

export type RdvHistoryAuthResult =
  | { isAuthorized: true; user: RdvHistoryUser; error?: undefined }
  | { isAuthorized: false; error: NextResponse; user?: undefined };

/**
 * Auth pour l'HISTORIQUE des rendez-vous (consultation/gestion). Plus stricte
 * que l'accès à l'outil de collage : autorise
 *   - les admins (accès complet, choisissent l'organisation à consulter) ;
 *   - les partenaires actifs, rattachés à une organisation, ET qui sont soit
 *     **responsables** (`isOrgManager`) soit **explicitement autorisés**
 *     (`canViewRdvHistory`).
 *
 * Les simples partenaires (ni responsables ni autorisés) peuvent utiliser
 * l'outil de collage mais PAS consulter l'historique du service.
 */
export async function requireRdvHistoryAccess(): Promise<RdvHistoryAuthResult> {
  const unauthorized: RdvHistoryAuthResult = {
    isAuthorized: false,
    error: NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: jsonHeaders }
    ),
  };

  const headerList = await headers();
  const session = await withDbRetry(() =>
    auth.api.getSession({ headers: headerList })
  ).catch(() => null);

  if (!session?.user?.id) return unauthorized;

  const dbUser = await withDbRetry(() =>
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        partnerOrganization: true,
        isOrgManager: true,
        canViewRdvHistory: true,
      },
    })
  ).catch(() => null);

  if (!dbUser || dbUser.status !== UserStatus.active) return unauthorized;

  const isAdmin = dbUser.role === "admin";
  const partnerHasAccess =
    dbUser.role === "partner" &&
    !!dbUser.partnerOrganization &&
    (dbUser.isOrgManager || dbUser.canViewRdvHistory);

  if (!isAdmin && !partnerHasAccess) {
    return {
      isAuthorized: false,
      error: NextResponse.json(
        {
          error:
            "Accès réservé aux responsables du service (ou aux personnes autorisées).",
        },
        { status: 403, headers: jsonHeaders }
      ),
    };
  }

  return {
    isAuthorized: true,
    user: {
      id: dbUser.id,
      name: dbUser.name,
      email: dbUser.email,
      role: dbUser.role,
      status: dbUser.status,
      partnerOrganization: dbUser.partnerOrganization,
      isAdmin,
      isOrgManager: dbUser.isOrgManager,
      canViewRdvHistory: dbUser.canViewRdvHistory,
    },
  };
}
