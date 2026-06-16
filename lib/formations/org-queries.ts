/**
 * Docbel Formations — requêtes & provisioning côté ORGANISATION (espaces
 * employeur/partenaire). Une FormationOrganization est créée à la volée pour un
 * pro (pont via User.partnerOrganization) lors de sa première création, avec des
 * permissions par défaut (sensibles OFF). L'admin affine ensuite via /admin.
 */
import "server-only";
import { Prisma, type FormationOrganization } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ACTIVE_ENROLLMENT_STATUSES } from "./constants";
import {
  listAccessibleFormationOrgs,
  formationOrgAccess,
  computeCapabilities,
  type OrgCapabilities,
} from "./access";

function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "org"
  );
}

/** Type d'org dérivé du rôle pro. */
function orgTypeForRole(role: string): string {
  return role === "employer" ? "employeur" : "partenaire";
}

/**
 * Résout (ou crée) la FormationOrganization d'un pro à partir de son
 * partnerOrganization. Renvoie null si l'utilisateur n'a pas d'organisation
 * rattachée (ex: admin sans org → doit passer par /admin).
 */
export async function resolveOrCreateFormationOrg(
  userId: string,
  role: string,
  partnerOrganization: string | null,
): Promise<FormationOrganization | null> {
  if (!partnerOrganization) return null;

  const existing = await prisma.formationOrganization.findFirst({
    where: { partnerOrganization },
  });
  if (existing) return existing;

  let slug = slugify(partnerOrganization);
  const clash = await prisma.formationOrganization.findUnique({ where: { slug } });
  if (clash) slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;

  try {
    return await prisma.formationOrganization.create({
      data: {
        slug,
        name: partnerOrganization,
        type: orgTypeForRole(role),
        partnerOrganization,
        status: "active",
        createdById: userId,
        permission: { create: {} }, // défauts (sensibles OFF)
      },
    });
  } catch (e) {
    // Course condition : un autre process a créé l'org entre-temps.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const again = await prisma.formationOrganization.findFirst({ where: { partnerOrganization } });
      if (again) return again;
    }
    throw e;
  }
}

export async function getAccessibleOrgIds(userId: string, role: string): Promise<string[]> {
  const orgs = await listAccessibleFormationOrgs(userId, role);
  return orgs.map((o) => o.id);
}

export interface OrgContext {
  orgIds: string[];
  /** Capacités effectives (org existante) ou défauts (org auto-créée à la 1re
   * création — l'utilisateur en deviendra owner avec permissions par défaut). */
  caps: OrgCapabilities;
  /** Visibilités proposables dans le wizard, selon les capacités. */
  allowedVisibilities: string[];
}

export async function getOrgContext(userId: string, role: string): Promise<OrgContext> {
  const orgs = await listAccessibleFormationOrgs(userId, role);
  const caps =
    orgs.length === 0
      ? computeCapabilities("owner", null)
      : (await formationOrgAccess(userId, role, orgs[0].id)).capabilities;

  const allowedVisibilities = ["draft", "unlisted"];
  if (caps.createPublic) allowedVisibilities.unshift("public");
  if (caps.createPrivate) allowedVisibilities.push("private");
  if (caps.createInternal) allowedVisibilities.push("internal");

  return { orgIds: orgs.map((o) => o.id), caps, allowedVisibilities };
}

export interface OrgTrainingListItem {
  id: string;
  slug: string;
  title: string;
  status: string;
  visibility: string;
  priceType: string;
  priceAmount: number | null;
  currency: string;
  categoryName: string | null;
  sessionsCount: number;
  createdAt: string;
  updatedAt: string;
}

export async function listOrgTrainings(orgIds: string[]): Promise<OrgTrainingListItem[]> {
  if (orgIds.length === 0) return [];
  const rows = await prisma.training.findMany({
    where: { organizationId: { in: orgIds } },
    include: {
      category: { select: { name: true } },
      _count: { select: { sessions: true } },
    },
    orderBy: { updatedAt: "desc" },
  });
  return rows.map((t) => ({
    id: t.id,
    slug: t.slug,
    title: t.title,
    status: t.status,
    visibility: t.visibility,
    priceType: t.priceType,
    priceAmount: t.priceAmount,
    currency: t.currency,
    categoryName: t.category?.name ?? null,
    sessionsCount: t._count.sessions,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  }));
}

export interface OrgStats {
  total: number;
  byStatus: Record<string, number>;
  published: number;
  pendingReview: number;
  pendingEnrollments: number;
  upcomingSessions: number;
}

export async function getOrgStats(orgIds: string[]): Promise<OrgStats> {
  if (orgIds.length === 0) {
    return { total: 0, byStatus: {}, published: 0, pendingReview: 0, pendingEnrollments: 0, upcomingSessions: 0 };
  }
  const [grouped, pendingEnrollments, upcomingSessions] = await Promise.all([
    prisma.training.groupBy({
      by: ["status"],
      where: { organizationId: { in: orgIds } },
      _count: { _all: true },
    }),
    prisma.trainingEnrollment.count({
      where: { organizationId: { in: orgIds }, status: { in: ["requested", "pending_review", "waitlisted"] } },
    }),
    prisma.trainingSession.count({
      where: { organizationId: { in: orgIds }, status: { in: ["scheduled", "open"] }, startsAt: { gte: new Date() } },
    }),
  ]);
  const byStatus: Record<string, number> = {};
  let total = 0;
  for (const g of grouped) {
    byStatus[g.status] = g._count._all;
    total += g._count._all;
  }
  return {
    total,
    byStatus,
    published: byStatus["published"] ?? 0,
    pendingReview: byStatus["pending_review"] ?? 0,
    pendingEnrollments,
    upcomingSessions,
  };
}

const orgTrainingInclude = {
  category: true,
  tags: { include: { tag: true } },
  accessRules: true,
  sessions: {
    orderBy: { startsAt: "asc" as const },
    include: {
      _count: {
        select: { enrollments: { where: { status: { in: ACTIVE_ENROLLMENT_STATUSES } } } },
      },
    },
  },
} satisfies Prisma.TrainingInclude;

export type OrgTrainingDetail = Prisma.TrainingGetPayload<{ include: typeof orgTrainingInclude }>;

export async function getOrgTraining(id: string): Promise<OrgTrainingDetail | null> {
  return prisma.training.findUnique({ where: { id }, include: orgTrainingInclude });
}

/** Tags d'orientation + thématiques disponibles, pour le wizard. */
export async function listAllTags() {
  return prisma.trainingTag.findMany({
    orderBy: [{ isOrientationTag: "desc" }, { name: "asc" }],
    select: { slug: true, name: true, isOrientationTag: true, type: true },
  });
}

export async function listCategoriesForSelect() {
  return prisma.trainingCategory.findMany({
    where: { isActive: true },
    orderBy: { order: "asc" },
    select: { id: true, slug: true, name: true },
  });
}

export interface OrgEnrollmentRow {
  id: string;
  status: string;
  citizenName: string | null;
  citizenEmail: string | null;
  citizenPhone: string | null;
  message: string | null;
  organizationNote: string | null;
  requestedAt: string;
}

export interface OrgEnrollmentSession {
  id: string;
  label: string | null;
  mode: string;
  city: string | null;
  capacity: number | null;
  enrollments: OrgEnrollmentRow[];
}

/** Inscriptions d'une formation, groupées par session (page de gestion org). */
export async function getTrainingWithEnrollments(
  trainingId: string,
): Promise<{ title: string; sessions: OrgEnrollmentSession[] } | null> {
  const training = await prisma.training.findUnique({
    where: { id: trainingId },
    select: {
      title: true,
      sessions: {
        orderBy: { startsAt: "asc" },
        select: {
          id: true,
          startsAt: true,
          mode: true,
          city: true,
          capacity: true,
          enrollments: { orderBy: { requestedAt: "asc" } },
        },
      },
    },
  });
  if (!training) return null;
  return {
    title: training.title,
    sessions: training.sessions.map((s) => ({
      id: s.id,
      label: s.startsAt ? s.startsAt.toISOString() : null,
      mode: s.mode,
      city: s.city,
      capacity: s.capacity,
      enrollments: s.enrollments.map((e) => ({
        id: e.id,
        status: e.status,
        citizenName: e.citizenName,
        citizenEmail: e.citizenEmail,
        citizenPhone: e.citizenPhone,
        message: e.message,
        organizationNote: e.organizationNote,
        requestedAt: e.requestedAt.toISOString(),
      })),
    })),
  };
}
