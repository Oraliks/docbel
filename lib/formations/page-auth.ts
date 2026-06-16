/** Résolution d'auth côté PAGE pour le module Formations. */
import "server-only";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { FormationViewer } from "./access";

export interface FormationsPageUser {
  id: string;
  role: string;
  isAdmin: boolean;
  partnerOrganization: string | null;
  segment: string | null;
  partnerType: string | null;
  email: string;
  name: string;
}

/**
 * Utilisateur connecté enrichi (org/segment) pour les pages Formations, ou null
 * si anonyme. Ne redirige pas — la page décide.
 */
export async function getFormationsPageUser(): Promise<FormationsPageUser | null> {
  const session = await auth.api
    .getSession({ headers: await headers() })
    .catch(() => null);
  const sUser = session?.user;
  if (!sUser?.id) return null;

  const dbUser = await prisma.user
    .findUnique({
      where: { id: sUser.id },
      select: {
        id: true,
        role: true,
        email: true,
        name: true,
        partnerOrganization: true,
        segment: true,
        partnerType: true,
      },
    })
    .catch(() => null);
  if (!dbUser) return null;

  return {
    id: dbUser.id,
    role: dbUser.role,
    isAdmin: dbUser.role === "admin",
    partnerOrganization: dbUser.partnerOrganization,
    segment: dbUser.segment,
    partnerType: dbUser.partnerType,
    email: dbUser.email,
    name: dbUser.name,
  };
}

/**
 * Garde de page pour l'espace org (employeur/partenaire). Renvoie l'utilisateur
 * si son rôle correspond au segment (ou admin), sinon null — la page redirige
 * alors vers la landing marketing du segment.
 */
export async function getOrgPageUser(
  segment: "employeur" | "partenaire",
): Promise<FormationsPageUser | null> {
  const u = await getFormationsPageUser();
  if (!u) return null;
  const expectedRole = segment === "employeur" ? "employer" : "partner";
  if (u.isAdmin || u.role === expectedRole) return u;
  return null;
}

/** Convertit en FormationViewer (pour canViewTraining), anonyme inclus. */
export async function getFormationsViewer(): Promise<FormationViewer> {
  const u = await getFormationsPageUser();
  if (!u) return { id: null, role: null };
  return {
    id: u.id,
    role: u.role,
    email: u.email,
    partnerOrganization: u.partnerOrganization,
    segment: u.segment,
    partnerType: u.partnerType,
  };
}
