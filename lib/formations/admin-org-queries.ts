/**
 * Docbel Formations — requêtes ADMIN dédiées aux ORGANISMES (lecture seule).
 *
 * Complément de `admin-queries.ts` (qui couvre les formations, la taxonomie et
 * une vue « organisation + permissions » réduite). Ici on sert la **file de
 * validation** des organismes : demandes en attente, vérification BCE, contacts,
 * décisions passées.
 *
 * Comme partout dans le module, les mappers renvoient des objets **sérialisables**
 * (dates en ISO) afin d'être passés tels quels d'un Server Component vers un
 * Client Component.
 *
 * Note : `FormationOrgMember.userId` est une référence LIBRE (pas de FK vers
 * `User`), donc les noms/emails des membres sont résolus par une seconde requête
 * puis joints en mémoire — un membre dont le compte n'existe plus reste listé
 * avec `name`/`email` à `null`.
 */
import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isOrgStatus, type FormationOrgStatus } from "./constants";

// --- Liste ------------------------------------------------------------------

const orgListInclude = {
  _count: { select: { members: true, trainings: true, invites: true } },
} satisfies Prisma.FormationOrganizationInclude;

type OrgWithCounts = Prisma.FormationOrganizationGetPayload<{
  include: typeof orgListInclude;
}>;

/** Ligne d'organisme pour la file de validation admin (dates ISO). */
export interface AdminOrgRow {
  id: string;
  slug: string;
  name: string;
  type: string;
  status: string;
  description: string | null;
  logoUrl: string | null;
  brandColor: string | null;
  website: string | null;
  contactEmail: string | null;
  notifyEmail: string | null;
  createdById: string | null;
  organismeId: string | null;
  partnerOrganization: string | null;
  // Vérification BCE / KBO
  enterpriseNumber: string | null;
  legalName: string | null;
  enterpriseVerified: boolean;
  enterpriseVerifiedAt: string | null;
  // Adresse
  street: string | null;
  postalCode: string | null;
  city: string | null;
  // Personne de contact
  contactName: string | null;
  contactRole: string | null;
  contactPhone: string | null;
  // Cycle de vie / décision admin
  submittedAt: string | null;
  reviewedById: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  rejectedReason: string | null;
  createdAt: string;
  updatedAt: string;
  // Compteurs (Prisma `_count`)
  membersCount: number;
  trainingsCount: number;
  invitesCount: number;
}

function iso(d: Date | null): string | null {
  return d ? d.toISOString() : null;
}

function toAdminOrgRow(o: OrgWithCounts): AdminOrgRow {
  return {
    id: o.id,
    slug: o.slug,
    name: o.name,
    type: o.type,
    status: o.status,
    description: o.description,
    logoUrl: o.logoUrl,
    brandColor: o.brandColor,
    website: o.website,
    contactEmail: o.contactEmail,
    notifyEmail: o.notifyEmail,
    createdById: o.createdById,
    organismeId: o.organismeId,
    partnerOrganization: o.partnerOrganization,
    enterpriseNumber: o.enterpriseNumber,
    legalName: o.legalName,
    enterpriseVerified: o.enterpriseVerified,
    enterpriseVerifiedAt: iso(o.enterpriseVerifiedAt),
    street: o.street,
    postalCode: o.postalCode,
    city: o.city,
    contactName: o.contactName,
    contactRole: o.contactRole,
    contactPhone: o.contactPhone,
    submittedAt: iso(o.submittedAt),
    reviewedById: o.reviewedById,
    reviewedAt: iso(o.reviewedAt),
    reviewNote: o.reviewNote,
    rejectedReason: o.rejectedReason,
    createdAt: o.createdAt.toISOString(),
    updatedAt: o.updatedAt.toISOString(),
    membersCount: o._count.members,
    trainingsCount: o._count.trainings,
    invitesCount: o._count.invites,
  };
}

/**
 * Tri de la file : les demandes `pending` d'abord (la plus récemment soumise en
 * tête), le reste par nom. Fait en mémoire car Postgres ne sait pas trier sur
 * « ce statut d'abord » sans expression SQL brute.
 */
function compareOrgRows(a: AdminOrgRow, b: AdminOrgRow): number {
  const aPending = a.status === "pending";
  const bPending = b.status === "pending";
  if (aPending !== bPending) return aPending ? -1 : 1;

  if (aPending && bPending) {
    const at = a.submittedAt ? Date.parse(a.submittedAt) : null;
    const bt = b.submittedAt ? Date.parse(b.submittedAt) : null;
    if (at !== bt) {
      if (at === null) return 1; // jamais soumise → en bas de la file
      if (bt === null) return -1;
      return bt - at; // submittedAt desc
    }
  }
  return a.name.localeCompare(b.name, "fr-BE");
}

/**
 * Toutes les organisations de formation, filtrables par statut.
 * Un `status` inconnu (ou absent) = pas de filtre.
 */
export async function listAdminOrgs(status?: string): Promise<AdminOrgRow[]> {
  const where =
    status && isOrgStatus(status) ? { status } : undefined;

  const orgs = await prisma.formationOrganization.findMany({
    where,
    include: orgListInclude,
    orderBy: [{ name: "asc" }],
  });

  return orgs.map(toAdminOrgRow).sort(compareOrgRows);
}

// --- Compteurs --------------------------------------------------------------

export interface AdminOrgStats {
  pending: number;
  active: number;
  suspended: number;
  rejected: number;
  total: number;
}

/** Compteurs par statut (+ total) pour les tuiles de la file de validation. */
export async function getAdminOrgStats(): Promise<AdminOrgStats> {
  const grouped = await prisma.formationOrganization.groupBy({
    by: ["status"],
    _count: true,
  });

  const stats: AdminOrgStats = {
    pending: 0,
    active: 0,
    suspended: 0,
    rejected: 0,
    total: 0,
  };

  for (const g of grouped) {
    const n = g._count;
    stats.total += n;
    // Un statut hors ensemble borné (donnée legacy) compte dans le total seul.
    if (isOrgStatus(g.status)) {
      const key: FormationOrgStatus = g.status;
      stats[key] += n;
    }
  }

  return stats;
}

// --- Détail -----------------------------------------------------------------

/** Capacités de création (1:1), sérialisées. */
export interface AdminOrgPermissionFlags {
  canCreateTraining: boolean;
  canSubmitTraining: boolean;
  canPublishDirectly: boolean;
  canCreatePublicTraining: boolean;
  canCreatePaidTraining: boolean;
  canCreatePrivateTraining: boolean;
  canCreateInternalTraining: boolean;
  canManageSessions: boolean;
  canManageEnrollments: boolean;
  canViewParticipantData: boolean;
  canExportParticipants: boolean;
  canIssueCertificate: boolean;
  canUseDocbelBadge: boolean;
  canRequestFeaturedPlacement: boolean;
  canCreateLearningModules: boolean;
  canCreateQuizzes: boolean;
  canManageTrainingPaths: boolean;
  canUseMarketplace: boolean;
  canReceivePayments: boolean;
  canUsePartnerApi: boolean;
  updatedById: string | null;
  updatedAt: string;
}

/** Membre d'équipe, avec identité résolue (jointure manuelle, cf. en-tête). */
export interface AdminOrgMember {
  id: string;
  userId: string;
  role: string;
  name: string | null;
  email: string | null;
  createdAt: string;
}

export interface AdminOrgDetail extends AdminOrgRow {
  permission: AdminOrgPermissionFlags | null;
  members: AdminOrgMember[];
}

/** Détail complet d'une organisation (null si introuvable). */
export async function getAdminOrg(id: string): Promise<AdminOrgDetail | null> {
  const org = await prisma.formationOrganization.findUnique({
    where: { id },
    include: {
      ...orgListInclude,
      permission: true,
      members: { orderBy: [{ createdAt: "asc" }] },
    },
  });
  if (!org) return null;

  const userIds = [...new Set(org.members.map((m) => m.userId))];
  const users = userIds.length
    ? await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true, email: true },
      })
    : [];
  const byId = new Map(users.map((u) => [u.id, u]));

  const p = org.permission;

  return {
    ...toAdminOrgRow(org),
    permission: p
      ? {
          canCreateTraining: p.canCreateTraining,
          canSubmitTraining: p.canSubmitTraining,
          canPublishDirectly: p.canPublishDirectly,
          canCreatePublicTraining: p.canCreatePublicTraining,
          canCreatePaidTraining: p.canCreatePaidTraining,
          canCreatePrivateTraining: p.canCreatePrivateTraining,
          canCreateInternalTraining: p.canCreateInternalTraining,
          canManageSessions: p.canManageSessions,
          canManageEnrollments: p.canManageEnrollments,
          canViewParticipantData: p.canViewParticipantData,
          canExportParticipants: p.canExportParticipants,
          canIssueCertificate: p.canIssueCertificate,
          canUseDocbelBadge: p.canUseDocbelBadge,
          canRequestFeaturedPlacement: p.canRequestFeaturedPlacement,
          canCreateLearningModules: p.canCreateLearningModules,
          canCreateQuizzes: p.canCreateQuizzes,
          canManageTrainingPaths: p.canManageTrainingPaths,
          canUseMarketplace: p.canUseMarketplace,
          canReceivePayments: p.canReceivePayments,
          canUsePartnerApi: p.canUsePartnerApi,
          updatedById: p.updatedById,
          updatedAt: p.updatedAt.toISOString(),
        }
      : null,
    members: org.members.map((m) => {
      const u = byId.get(m.userId);
      return {
        id: m.id,
        userId: m.userId,
        role: m.role,
        name: u?.name ?? null,
        email: u?.email ?? null,
        createdAt: m.createdAt.toISOString(),
      };
    }),
  };
}
