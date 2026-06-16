/**
 * Docbel Formations — contrôle d'accès serveur. Trois sources d'autorisation
 * sur une organisation (calque de lib/booking/access.ts) :
 *   1. admin → owner partout (+ bypass des capacités)
 *   2. membre explicite (FormationOrgMember) → son rôle
 *   3. pont partenaire/employeur : User.partnerOrganization === org.partnerOrganization
 *      (responsables isOrgManager → owner, sinon manager)
 *
 * Les capacités fines (créer/privé/publier…) combinent le RÔLE du membre et les
 * FLAGS d'organisation (OrganizationTrainingPermission), réglés par l'admin.
 */
import "server-only";
import type {
  FormationOrganization,
  OrganizationTrainingPermission,
  Training,
  TrainingAccessRule,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { FormationOrgRole } from "./constants";

export type EffectiveOrgRole = FormationOrgRole | null;

/** Capacités résolues pour un (membre, organisation). */
export interface OrgCapabilities {
  view: boolean;
  create: boolean;
  createPublic: boolean;
  createPaid: boolean;
  createPrivate: boolean;
  createInternal: boolean;
  submit: boolean;
  publishDirectly: boolean;
  manageSessions: boolean;
  manageEnrollments: boolean;
  viewParticipants: boolean;
  exportParticipants: boolean;
  issueCertificate: boolean;
  useDocbelBadge: boolean;
  manageTeam: boolean;
  editOrg: boolean;
}

export interface FormationOrgAccess {
  org: FormationOrganization | null;
  role: EffectiveOrgRole;
  permission: OrganizationTrainingPermission | null;
  isAdmin: boolean;
  capabilities: OrgCapabilities;
}

const NO_CAPS: OrgCapabilities = {
  view: false,
  create: false,
  createPublic: false,
  createPaid: false,
  createPrivate: false,
  createInternal: false,
  submit: false,
  publishDirectly: false,
  manageSessions: false,
  manageEnrollments: false,
  viewParticipants: false,
  exportParticipants: false,
  issueCertificate: false,
  useDocbelBadge: false,
  manageTeam: false,
  editOrg: false,
};

const ALL_CAPS: OrgCapabilities = {
  view: true,
  create: true,
  createPublic: true,
  createPaid: true,
  createPrivate: true,
  createInternal: true,
  submit: true,
  publishDirectly: true,
  manageSessions: true,
  manageEnrollments: true,
  viewParticipants: true,
  exportParticipants: true,
  issueCertificate: true,
  useDocbelBadge: true,
  manageTeam: true,
  editOrg: true,
};

const canCreateRole = (r: EffectiveOrgRole) => r === "owner" || r === "manager";
const canManageRole = (r: EffectiveOrgRole) => r === "owner" || r === "manager";
const canViewParticipantsRole = (r: EffectiveOrgRole) =>
  r === "owner" || r === "manager" || r === "trainer";

/** Combine rôle membre + flags d'organisation en capacités concrètes. */
export function computeCapabilities(
  role: EffectiveOrgRole,
  perm: OrganizationTrainingPermission | null,
): OrgCapabilities {
  if (!role) return NO_CAPS;
  const create = canCreateRole(role);
  const manage = canManageRole(role);
  // Sans ligne de permission, on retombe sur des défauts permissifs pour les
  // capacités de base (créer/soumettre/public) et restrictifs pour le sensible.
  const p = perm;
  return {
    view: true,
    create: create && (p?.canCreateTraining ?? true),
    createPublic: create && (p?.canCreatePublicTraining ?? true),
    createPaid: create && (p?.canCreatePaidTraining ?? true),
    createPrivate: create && (p?.canCreatePrivateTraining ?? false),
    createInternal: create && (p?.canCreateInternalTraining ?? false),
    submit: create && (p?.canSubmitTraining ?? true),
    publishDirectly: manage && (p?.canPublishDirectly ?? false),
    manageSessions: manage && (p?.canManageSessions ?? true),
    manageEnrollments: manage && (p?.canManageEnrollments ?? true),
    viewParticipants: canViewParticipantsRole(role) && (p?.canViewParticipantData ?? true),
    exportParticipants: manage && (p?.canExportParticipants ?? false),
    issueCertificate: manage && (p?.canIssueCertificate ?? false),
    useDocbelBadge: manage && (p?.canUseDocbelBadge ?? false),
    manageTeam: role === "owner",
    editOrg: role === "owner",
  };
}

/**
 * Résout l'accès d'un utilisateur à une organisation de formation. Admin →
 * owner + toutes capacités. Sinon membre explicite, puis pont partenaire.
 */
export async function formationOrgAccess(
  userId: string,
  userRole: string,
  organizationId: string,
): Promise<FormationOrgAccess> {
  const org = await prisma.formationOrganization.findUnique({
    where: { id: organizationId },
    include: { permission: true },
  });
  if (!org) {
    return { org: null, role: null, permission: null, isAdmin: userRole === "admin", capabilities: NO_CAPS };
  }
  const permission = org.permission ?? null;
  const { permission: _omit, ...orgRow } = org;

  if (userRole === "admin") {
    return { org: orgRow, role: "owner", permission, isAdmin: true, capabilities: ALL_CAPS };
  }

  const member = await prisma.formationOrgMember.findUnique({
    where: { organizationId_userId: { organizationId, userId } },
  });
  if (member) {
    const role = member.role as EffectiveOrgRole;
    return { org: orgRow, role, permission, isAdmin: false, capabilities: computeCapabilities(role, permission) };
  }

  if (org.partnerOrganization) {
    const u = await prisma.user.findUnique({
      where: { id: userId },
      select: { partnerOrganization: true, isOrgManager: true },
    });
    if (u?.partnerOrganization && u.partnerOrganization === org.partnerOrganization) {
      const role: EffectiveOrgRole = u.isOrgManager ? "owner" : "manager";
      return { org: orgRow, role, permission, isAdmin: false, capabilities: computeCapabilities(role, permission) };
    }
  }

  return { org: orgRow, role: null, permission, isAdmin: false, capabilities: NO_CAPS };
}

/** Liste les organisations de formation qu'un utilisateur peut gérer. */
export async function listAccessibleFormationOrgs(
  userId: string,
  userRole: string,
): Promise<FormationOrganization[]> {
  if (userRole === "admin") {
    return prisma.formationOrganization.findMany({ orderBy: { name: "asc" } });
  }
  const memberships = await prisma.formationOrgMember.findMany({
    where: { userId },
    select: { organizationId: true },
  });
  const ids = new Set(memberships.map((m) => m.organizationId));

  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { partnerOrganization: true },
  });
  if (u?.partnerOrganization) {
    const orgs = await prisma.formationOrganization.findMany({
      where: { partnerOrganization: u.partnerOrganization },
      select: { id: true },
    });
    for (const o of orgs) ids.add(o.id);
  }

  if (ids.size === 0) return [];
  return prisma.formationOrganization.findMany({
    where: { id: { in: [...ids] } },
    orderBy: { name: "asc" },
  });
}

// --- Visibilité d'une formation (page détail) ------------------------------

export interface FormationViewer {
  id: string | null;
  role: string | null;
  email?: string | null;
  partnerOrganization?: string | null;
  segment?: string | null;
  partnerType?: string | null;
}

type TrainingForView = Pick<
  Training,
  "id" | "organizationId" | "visibility" | "status" | "createdById"
> & { accessRules?: TrainingAccessRule[] };

function matchesAccessRule(rule: TrainingAccessRule, viewer: FormationViewer): boolean {
  switch (rule.type) {
    case "user":
      return !!viewer.id && rule.userId === viewer.id;
    case "email_invite":
      return (
        !!viewer.email &&
        !!rule.email &&
        rule.email.toLowerCase() === viewer.email.toLowerCase()
      );
    case "role":
      return !!viewer.role && rule.role === viewer.role;
    case "segment":
      return !!viewer.segment && rule.segment === viewer.segment;
    case "partner":
      return !!viewer.partnerType && rule.partnerType === viewer.partnerType;
    case "admin_selected":
      return !!viewer.id && rule.userId === viewer.id;
    default:
      return false;
  }
}

/**
 * Décide si un viewer peut voir une formation précise (page détail). Le contrôle
 * est TOUJOURS côté serveur : connaître le slug ne suffit pas pour une formation
 * privée/interne. Charge l'appartenance org + règles d'accès au besoin.
 */
export async function canViewTraining(
  viewer: FormationViewer,
  training: TrainingForView,
): Promise<boolean> {
  if (viewer.role === "admin") return true;

  const accessRules = training.accessRules ?? [];

  const isOrgMember = viewer.id
    ? (await formationOrgAccess(viewer.id, viewer.role ?? "user", training.organizationId)).role != null
    : false;
  const isCreator = !!viewer.id && training.createdById === viewer.id;

  // Non publiée : réservée à l'organisation + créateur.
  if (training.status !== "published") {
    return isOrgMember || isCreator;
  }

  switch (training.visibility) {
    case "public":
    case "unlisted": // accessible par lien direct
      return true;
    case "private":
      if (isOrgMember || isCreator) return true;
      return accessRules.some((r) => matchesAccessRule(r, viewer));
    case "internal":
      if (isOrgMember || isCreator) return true;
      // Audience interne élargie (segment/partner) via règles d'accès.
      return accessRules.some(
        (r) =>
          (r.type === "segment" || r.type === "partner" || r.type === "organization") &&
          matchesAccessRule(r, viewer),
      );
    case "draft":
    default:
      return isOrgMember || isCreator;
  }
}
