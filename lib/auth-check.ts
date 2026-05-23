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
 * Auth pour les pages/routes "Espace Partenaire". Autorise :
 *   - les admins (role=admin, active) → accès complet
 *   - les partners avec une organisation rattachée (role=partner + partnerOrganization)
 *
 * Renvoie un AuthorizedUser enrichi avec `partnerOrganization` et `isAdmin` pour
 * que les routes/pages puissent adapter leur logique (ex: scoper les données par org
 * partenaire, ou exposer tout pour les admins).
 */
export async function requirePartnerOrAdminAuth(): Promise<PartnerAuthResult> {
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
  const isPartnerWithOrg =
    dbUser.role === "partner" && !!dbUser.partnerOrganization;

  if (!isAdmin && !isPartnerWithOrg) {
    return {
      isAuthorized: false,
      error: NextResponse.json(
        { error: "Forbidden - Partner or Admin access required" },
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
