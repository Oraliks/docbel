/**
 * Invitations d'équipe d'une organisation de formation.
 * Cycle de vie : pending → accepted | revoked | expired.
 * Le token est opaque (nanoid 32) et à usage unique.
 */
import "server-only";
import { nanoid } from "nanoid";
import { prisma } from "@/lib/prisma";
import { ORG_INVITE_TTL_DAYS, ORG_ROLE_LABELS, type FormationOrgRole } from "./constants";
import { sendOrgInviteEmail } from "./emails";

export type InviteRole = Exclude<FormationOrgRole, "owner">;

export interface InviteResult {
  ok: boolean;
  error?: "already_member" | "already_invited" | "not_found";
  inviteId?: string;
}

const normEmail = (e: string) => e.trim().toLowerCase();

/**
 * Crée (ou re-émet) une invitation et envoie l'email. Re-inviter une adresse
 * déjà invitée régénère le token et repousse l'expiration.
 */
export async function inviteMember(params: {
  organizationId: string;
  email: string;
  role: InviteRole;
  invitedById: string;
  inviterName?: string | null;
}): Promise<InviteResult> {
  const email = normEmail(params.email);

  const org = await prisma.formationOrganization.findUnique({
    where: { id: params.organizationId },
    select: { id: true, name: true },
  });
  if (!org) return { ok: false, error: "not_found" };

  // Déjà membre ? (on résout l'email vers un User existant)
  const existingUser = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existingUser) {
    const member = await prisma.formationOrgMember.findUnique({
      where: { organizationId_userId: { organizationId: org.id, userId: existingUser.id } },
      select: { id: true },
    });
    if (member) return { ok: false, error: "already_member" };
  }

  const token = nanoid(32);
  const expiresAt = new Date(Date.now() + ORG_INVITE_TTL_DAYS * 24 * 3600 * 1000);

  const invite = await prisma.formationOrgInvite.upsert({
    where: { organizationId_email: { organizationId: org.id, email } },
    create: {
      organizationId: org.id,
      email,
      role: params.role,
      token,
      status: "pending",
      invitedById: params.invitedById,
      expiresAt,
    },
    update: {
      role: params.role,
      token,
      status: "pending",
      invitedById: params.invitedById,
      expiresAt,
      acceptedAt: null,
      acceptedByUserId: null,
    },
  });

  await sendOrgInviteEmail({
    to: email,
    orgName: org.name,
    inviterName: params.inviterName ?? null,
    roleLabel: ORG_ROLE_LABELS[params.role],
    token,
    expiresAt,
  });

  return { ok: true, inviteId: invite.id };
}

export interface InviteLookup {
  id: string;
  organizationId: string;
  organizationName: string;
  email: string;
  role: string;
  expiresAt: Date;
  /** valid | expired | used | revoked | unknown */
  state: "valid" | "expired" | "used" | "revoked" | "unknown";
}

/** Résout un token d'invitation et son état (sans le consommer). */
export async function lookupInvite(token: string): Promise<InviteLookup | null> {
  const invite = await prisma.formationOrgInvite.findUnique({
    where: { token },
    include: { organization: { select: { name: true } } },
  });
  if (!invite) return null;

  const state: InviteLookup["state"] =
    invite.status === "accepted"
      ? "used"
      : invite.status === "revoked"
        ? "revoked"
        : invite.expiresAt.getTime() < Date.now()
          ? "expired"
          : invite.status === "pending"
            ? "valid"
            : "unknown";

  return {
    id: invite.id,
    organizationId: invite.organizationId,
    organizationName: invite.organization.name,
    email: invite.email,
    role: invite.role,
    expiresAt: invite.expiresAt,
    state,
  };
}

/**
 * Consomme une invitation valide : crée le membre et marque l'invitation
 * acceptée, en une transaction. Idempotent si l'utilisateur est déjà membre.
 */
export async function acceptInvite(
  token: string,
  userId: string,
): Promise<{ ok: boolean; organizationId?: string; error?: string }> {
  const invite = await prisma.formationOrgInvite.findUnique({ where: { token } });
  if (!invite) return { ok: false, error: "Invitation introuvable." };
  if (invite.status === "accepted") return { ok: false, error: "Invitation déjà utilisée." };
  if (invite.status === "revoked") return { ok: false, error: "Invitation révoquée." };
  if (invite.expiresAt.getTime() < Date.now()) {
    await prisma.formationOrgInvite.update({
      where: { id: invite.id },
      data: { status: "expired" },
    });
    return { ok: false, error: "Invitation expirée." };
  }

  await prisma.$transaction([
    prisma.formationOrgMember.upsert({
      where: {
        organizationId_userId: { organizationId: invite.organizationId, userId },
      },
      create: { organizationId: invite.organizationId, userId, role: invite.role },
      update: { role: invite.role },
    }),
    prisma.formationOrgInvite.update({
      where: { id: invite.id },
      data: { status: "accepted", acceptedAt: new Date(), acceptedByUserId: userId },
    }),
  ]);

  return { ok: true, organizationId: invite.organizationId };
}

export async function revokeInvite(inviteId: string): Promise<void> {
  await prisma.formationOrgInvite.update({
    where: { id: inviteId },
    data: { status: "revoked" },
  });
}

/** Membres + invitations en attente d'une organisation (page Équipe). */
export async function listTeam(organizationId: string) {
  const [members, invites] = await Promise.all([
    prisma.formationOrgMember.findMany({
      where: { organizationId },
      orderBy: { createdAt: "asc" },
    }),
    prisma.formationOrgInvite.findMany({
      where: { organizationId, status: "pending" },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const userIds = members.map((m) => m.userId);
  const users = userIds.length
    ? await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true, email: true },
      })
    : [];
  const byId = new Map(users.map((u) => [u.id, u]));

  return {
    members: members.map((m) => ({
      id: m.id,
      userId: m.userId,
      role: m.role,
      name: byId.get(m.userId)?.name ?? "—",
      email: byId.get(m.userId)?.email ?? "—",
      createdAt: m.createdAt.toISOString(),
    })),
    invites: invites.map((i) => ({
      id: i.id,
      email: i.email,
      role: i.role,
      expiresAt: i.expiresAt.toISOString(),
      createdAt: i.createdAt.toISOString(),
    })),
  };
}
