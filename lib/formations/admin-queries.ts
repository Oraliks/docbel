/**
 * Docbel Formations — requêtes ADMIN (lecture). Server-only. À l'inverse de
 * `queries.ts` (catalogue public, visibilité imposée), ces helpers donnent la
 * visibilité TOTALE à l'admin (tous statuts / toutes visibilités) pour piloter
 * la modération, les permissions, la taxonomie et les signalements.
 *
 * Les mappers renvoient des objets sérialisables (dates ISO) afin d'être passés
 * tels quels des Server Components vers les Client Components.
 */
import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { TRAINING_STATUSES, type TrainingStatus } from "./constants";

// --- Liste des formations (overview) --------------------------------------

const adminListInclude = {
  organization: { select: { id: true, name: true, slug: true, type: true } },
  category: { select: { id: true, name: true, slug: true } },
  tags: { include: { tag: { select: { slug: true, name: true } } } },
  _count: { select: { sessions: true } },
} satisfies Prisma.TrainingInclude;

type TrainingWithAdminList = Prisma.TrainingGetPayload<{
  include: typeof adminListInclude;
}>;

export interface AdminTrainingRow {
  id: string;
  slug: string;
  title: string;
  status: string;
  visibility: string;
  priceType: string;
  priceAmount: number | null;
  currency: string;
  isFeatured: boolean;
  isDocbelRecommended: boolean;
  isVerifiedByDocbel: boolean;
  adminReviewNote: string | null;
  rejectedReason: string | null;
  organization: { id: string; name: string; slug: string; type: string } | null;
  category: { id: string; name: string; slug: string } | null;
  tags: { slug: string; name: string }[];
  sessionsCount: number;
  submittedAt: string | null;
  approvedAt: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

function toAdminRow(t: TrainingWithAdminList): AdminTrainingRow {
  return {
    id: t.id,
    slug: t.slug,
    title: t.title,
    status: t.status,
    visibility: t.visibility,
    priceType: t.priceType,
    priceAmount: t.priceAmount,
    currency: t.currency,
    isFeatured: t.isFeatured,
    isDocbelRecommended: t.isDocbelRecommended,
    isVerifiedByDocbel: t.isVerifiedByDocbel,
    adminReviewNote: t.adminReviewNote,
    rejectedReason: t.rejectedReason,
    organization: t.organization
      ? {
          id: t.organization.id,
          name: t.organization.name,
          slug: t.organization.slug,
          type: t.organization.type,
        }
      : null,
    category: t.category
      ? { id: t.category.id, name: t.category.name, slug: t.category.slug }
      : null,
    tags: t.tags.map((x) => ({ slug: x.tag.slug, name: x.tag.name })),
    sessionsCount: t._count.sessions,
    submittedAt: t.submittedAt ? t.submittedAt.toISOString() : null,
    approvedAt: t.approvedAt ? t.approvedAt.toISOString() : null,
    publishedAt: t.publishedAt ? t.publishedAt.toISOString() : null,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}

export interface AdminTrainingFilter {
  status?: TrainingStatus | "all";
  search?: string;
}

/** Liste de toutes les formations (tous statuts), filtrable statut + recherche. */
export async function listAdminTrainings(
  filter: AdminTrainingFilter = {},
  limit = 200,
): Promise<AdminTrainingRow[]> {
  const and: Prisma.TrainingWhereInput[] = [];
  if (filter.status && filter.status !== "all") {
    and.push({ status: filter.status });
  }
  if (filter.search?.trim()) {
    const q = filter.search.trim();
    and.push({
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { slug: { contains: q, mode: "insensitive" } },
        { organization: { is: { name: { contains: q, mode: "insensitive" } } } },
      ],
    });
  }

  const rows = await prisma.training.findMany({
    where: and.length ? { AND: and } : undefined,
    include: adminListInclude,
    orderBy: [{ updatedAt: "desc" }],
    take: limit,
  });
  return rows.map(toAdminRow);
}

/** Compteurs par statut + agrégats pour les stat cards de l'overview. */
export async function getTrainingCounts(): Promise<{
  total: number;
  byStatus: Record<TrainingStatus, number>;
  privateInternal: number;
  organizations: number;
  openReports: number;
}> {
  const [grouped, privateInternal, organizations, openReports] =
    await Promise.all([
      prisma.training.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.training.count({
        where: { visibility: { in: ["private", "internal"] } },
      }),
      prisma.formationOrganization.count(),
      prisma.trainingReport.count({
        where: { status: { in: ["new", "in_progress"] } },
      }),
    ]);

  const byStatus = Object.fromEntries(
    TRAINING_STATUSES.map((s) => [s, 0]),
  ) as Record<TrainingStatus, number>;
  let total = 0;
  for (const g of grouped) {
    const count = g._count._all;
    total += count;
    if ((TRAINING_STATUSES as readonly string[]).includes(g.status)) {
      byStatus[g.status as TrainingStatus] = count;
    }
  }

  return { total, byStatus, privateInternal, organizations, openReports };
}

/** File d'attente de validation : pending_review + changes_requested. */
export async function listPendingReviewTrainings(): Promise<AdminTrainingRow[]> {
  const rows = await prisma.training.findMany({
    where: { status: { in: ["pending_review", "changes_requested"] } },
    include: adminListInclude,
    orderBy: [{ submittedAt: "asc" }, { updatedAt: "asc" }],
    take: 200,
  });
  return rows.map(toAdminRow);
}

// --- Organisations + permissions ------------------------------------------

export interface AdminOrgPermission {
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
}

export interface AdminOrgRow {
  id: string;
  slug: string;
  name: string;
  type: string;
  status: string;
  partnerOrganization: string | null;
  trainingsCount: number;
  membersCount: number;
  permission: AdminOrgPermission | null;
}

/** Toutes les organisations de formation + leur permission (1:1). */
export async function listOrganizationsWithPermission(): Promise<AdminOrgRow[]> {
  const orgs = await prisma.formationOrganization.findMany({
    include: {
      permission: true,
      _count: { select: { trainings: true, members: true } },
    },
    orderBy: [{ name: "asc" }],
  });

  return orgs.map((o) => ({
    id: o.id,
    slug: o.slug,
    name: o.name,
    type: o.type,
    status: o.status,
    partnerOrganization: o.partnerOrganization,
    trainingsCount: o._count.trainings,
    membersCount: o._count.members,
    permission: o.permission
      ? {
          canCreateTraining: o.permission.canCreateTraining,
          canSubmitTraining: o.permission.canSubmitTraining,
          canPublishDirectly: o.permission.canPublishDirectly,
          canCreatePublicTraining: o.permission.canCreatePublicTraining,
          canCreatePaidTraining: o.permission.canCreatePaidTraining,
          canCreatePrivateTraining: o.permission.canCreatePrivateTraining,
          canCreateInternalTraining: o.permission.canCreateInternalTraining,
          canManageSessions: o.permission.canManageSessions,
          canManageEnrollments: o.permission.canManageEnrollments,
          canViewParticipantData: o.permission.canViewParticipantData,
          canExportParticipants: o.permission.canExportParticipants,
          canIssueCertificate: o.permission.canIssueCertificate,
          canUseDocbelBadge: o.permission.canUseDocbelBadge,
          canRequestFeaturedPlacement: o.permission.canRequestFeaturedPlacement,
        }
      : null,
  }));
}

// --- Catégories / tags / badges -------------------------------------------

export interface AdminCategoryRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string;
  isActive: boolean;
  order: number;
  trainingsCount: number;
}

export async function listAdminCategories(): Promise<AdminCategoryRow[]> {
  const cats = await prisma.trainingCategory.findMany({
    include: { _count: { select: { trainings: true } } },
    orderBy: [{ order: "asc" }, { name: "asc" }],
  });
  return cats.map((c) => ({
    id: c.id,
    slug: c.slug,
    name: c.name,
    description: c.description,
    icon: c.icon,
    color: c.color,
    isActive: c.isActive,
    order: c.order,
    trainingsCount: c._count.trainings,
  }));
}

export interface AdminTagRow {
  id: string;
  slug: string;
  name: string;
  type: string | null;
  isOrientationTag: boolean;
  trainingsCount: number;
}

export async function listAdminTags(): Promise<AdminTagRow[]> {
  const tags = await prisma.trainingTag.findMany({
    include: { _count: { select: { trainings: true } } },
    orderBy: [{ name: "asc" }],
  });
  return tags.map((t) => ({
    id: t.id,
    slug: t.slug,
    name: t.name,
    type: t.type,
    isOrientationTag: t.isOrientationTag,
    trainingsCount: t._count.trainings,
  }));
}

export interface AdminBadgeRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  controlledByAdmin: boolean;
  icon: string | null;
  color: string | null;
  order: number;
  trainingsCount: number;
}

export async function listAdminBadges(): Promise<AdminBadgeRow[]> {
  const badges = await prisma.trainingBadge.findMany({
    include: { _count: { select: { trainings: true } } },
    orderBy: [{ order: "asc" }, { name: "asc" }],
  });
  return badges.map((b) => ({
    id: b.id,
    slug: b.slug,
    name: b.name,
    description: b.description,
    controlledByAdmin: b.controlledByAdmin,
    icon: b.icon,
    color: b.color,
    order: b.order,
    trainingsCount: b._count.trainings,
  }));
}

// --- Signalements ----------------------------------------------------------

export interface AdminReportRow {
  id: string;
  trainingId: string;
  trainingTitle: string | null;
  trainingSlug: string | null;
  reason: string;
  message: string | null;
  status: string;
  adminNote: string | null;
  actionTaken: string | null;
  reporterEmail: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

/**
 * Signalements (filtrable par statut). `trainingId` est une réf. libre :
 * on tente de résoudre le titre/slug de la formation pour l'affichage, sans
 * jointure FK (la formation peut avoir été supprimée).
 */
export async function listReports(filter: {
  status?: string;
} = {}): Promise<AdminReportRow[]> {
  const where: Prisma.TrainingReportWhereInput = {};
  if (filter.status && filter.status !== "all") {
    where.status = filter.status;
  }

  const reports = await prisma.trainingReport.findMany({
    where,
    orderBy: [{ createdAt: "desc" }],
    take: 300,
  });

  const trainingIds = [...new Set(reports.map((r) => r.trainingId))];
  const trainings = trainingIds.length
    ? await prisma.training.findMany({
        where: { id: { in: trainingIds } },
        select: { id: true, title: true, slug: true },
      })
    : [];
  const byId = new Map(trainings.map((t) => [t.id, t]));

  return reports.map((r) => {
    const t = byId.get(r.trainingId);
    return {
      id: r.id,
      trainingId: r.trainingId,
      trainingTitle: t?.title ?? null,
      trainingSlug: t?.slug ?? null,
      reason: r.reason,
      message: r.message,
      status: r.status,
      adminNote: r.adminNote,
      actionTaken: r.actionTaken,
      reporterEmail: r.reporterEmail,
      createdAt: r.createdAt.toISOString(),
      resolvedAt: r.resolvedAt ? r.resolvedAt.toISOString() : null,
    };
  });
}

export async function getReportCounts(): Promise<Record<string, number>> {
  const grouped = await prisma.trainingReport.groupBy({
    by: ["status"],
    _count: { _all: true },
  });
  const out: Record<string, number> = {
    all: 0,
    new: 0,
    in_progress: 0,
    resolved: 0,
    rejected: 0,
  };
  for (const g of grouped) {
    out[g.status] = (out[g.status] ?? 0) + g._count._all;
    out.all += g._count._all;
  }
  return out;
}

// --- Boussole --------------------------------------------------------------

export interface AdminOrientationOption {
  id: string;
  label: string;
  value: string;
  helperText: string | null;
  order: number;
}

export interface AdminOrientationQuestion {
  id: string;
  text: string;
  description: string | null;
  type: string;
  isActive: boolean;
  order: number;
  options: AdminOrientationOption[];
}

export async function listOrientationQuestions(): Promise<
  AdminOrientationQuestion[]
> {
  const questions = await prisma.orientationQuestion.findMany({
    include: { options: { orderBy: { order: "asc" } } },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
  });
  return questions.map((q) => ({
    id: q.id,
    text: q.text,
    description: q.description,
    type: q.type,
    isActive: q.isActive,
    order: q.order,
    options: q.options.map((o) => ({
      id: o.id,
      label: o.label,
      value: o.value,
      helperText: o.helperText,
      order: o.order,
    })),
  }));
}

export interface AdminOrientationBranch {
  id: string;
  key: string;
  slug: string;
  name: string;
  description: string | null;
  possibleJobs: string[];
  icon: string | null;
  color: string;
  isActive: boolean;
  order: number;
}

export async function listOrientationBranches(): Promise<
  AdminOrientationBranch[]
> {
  const branches = await prisma.orientationBranch.findMany({
    orderBy: [{ order: "asc" }, { name: "asc" }],
  });
  return branches.map((b) => ({
    id: b.id,
    key: b.key,
    slug: b.slug,
    name: b.name,
    description: b.description,
    possibleJobs: b.possibleJobs,
    icon: b.icon,
    color: b.color,
    isActive: b.isActive,
    order: b.order,
  }));
}
