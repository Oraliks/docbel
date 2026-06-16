/**
 * Docbel Formations — requêtes catalogue PUBLIC (lecture). La visibilité est
 * imposée côté serveur : le catalogue ne liste QUE published + public ; les
 * formations privées/internes ne s'y trouvent jamais (cf. canViewTraining pour
 * la page détail). Les mappers renvoient des objets sérialisables (dates ISO).
 */
import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ACTIVE_ENROLLMENT_STATUSES } from "./constants";
import { BRANCH_RECOMMENDATION } from "./seed-data";
import { isBranchKey } from "./boussole/branches";
import type { CatalogueFilter } from "./schemas";

const cardInclude = {
  organization: {
    select: { name: true, slug: true, logoUrl: true, brandColor: true, type: true },
  },
  category: { select: { slug: true, name: true, color: true, icon: true } },
  tags: { include: { tag: { select: { slug: true, name: true } } } },
  badges: { include: { badge: { select: { slug: true, name: true, icon: true, color: true } } } },
  sessions: {
    where: { status: { in: ["scheduled", "open", "ongoing"] } },
    orderBy: { startsAt: "asc" as const },
  },
  _count: { select: { sessions: true } },
} satisfies Prisma.TrainingInclude;

type TrainingWithCard = Prisma.TrainingGetPayload<{ include: typeof cardInclude }>;

export interface TrainingCardData {
  id: string;
  slug: string;
  title: string;
  shortDescription: string | null;
  level: string;
  format: string;
  durationHours: number | null;
  durationLabel: string | null;
  priceType: string;
  priceAmount: number | null;
  currency: string;
  certificateType: string;
  coverImageUrl: string | null;
  isFeatured: boolean;
  isDocbelRecommended: boolean;
  isVerifiedByDocbel: boolean;
  organization: { name: string; slug: string; logoUrl: string | null; brandColor: string | null; type: string };
  category: { slug: string; name: string; color: string; icon: string | null } | null;
  tags: { slug: string; name: string }[];
  badges: { slug: string; name: string; icon: string | null; color: string | null }[];
  nextSessionAt: string | null;
  nextSessionMode: string | null;
  nextSessionCity: string | null;
  nextSessionCapacity: number | null;
  sessionsCount: number;
}

function toCard(t: TrainingWithCard): TrainingCardData {
  const next = t.sessions[0] ?? null;
  return {
    id: t.id,
    slug: t.slug,
    title: t.title,
    shortDescription: t.shortDescription,
    level: t.level,
    format: t.format,
    durationHours: t.durationHours,
    durationLabel: t.totalDurationLabel,
    priceType: t.priceType,
    priceAmount: t.priceAmount,
    currency: t.currency,
    certificateType: t.certificateType,
    coverImageUrl: t.coverImageUrl,
    isFeatured: t.isFeatured,
    isDocbelRecommended: t.isDocbelRecommended,
    isVerifiedByDocbel: t.isVerifiedByDocbel,
    organization: {
      name: t.organization.name,
      slug: t.organization.slug,
      logoUrl: t.organization.logoUrl,
      brandColor: t.organization.brandColor,
      type: t.organization.type,
    },
    category: t.category
      ? { slug: t.category.slug, name: t.category.name, color: t.category.color, icon: t.category.icon }
      : null,
    tags: t.tags.map((x) => ({ slug: x.tag.slug, name: x.tag.name })),
    badges: t.badges.map((x) => ({ slug: x.badge.slug, name: x.badge.name, icon: x.badge.icon, color: x.badge.color })),
    nextSessionAt: next?.startsAt ? next.startsAt.toISOString() : null,
    nextSessionMode: next?.mode ?? null,
    nextSessionCity: next?.city ?? null,
    nextSessionCapacity: next?.capacity ?? null,
    sessionsCount: t._count.sessions,
  };
}

/** Construit le `where` Prisma du catalogue public à partir des filtres. */
function buildCatalogueWhere(filter: CatalogueFilter): Prisma.TrainingWhereInput {
  const and: Prisma.TrainingWhereInput[] = [
    { status: "published", visibility: "public" },
  ];

  if (filter.q) {
    const q = filter.q;
    and.push({
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { shortDescription: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
        { keywords: { has: q.toLowerCase() } },
        { organization: { is: { name: { contains: q, mode: "insensitive" } } } },
      ],
    });
  }
  if (filter.category) and.push({ category: { is: { slug: filter.category } } });
  if (filter.format) and.push({ format: filter.format });
  if (filter.level) and.push({ level: filter.level });
  if (filter.price) and.push({ priceType: filter.price });
  if (filter.certificate === "yes") and.push({ certificateType: { not: "none" } });
  if (filter.region) and.push({ sessions: { some: { region: filter.region } } });
  if (filter.tag) and.push({ tags: { some: { tag: { is: { slug: filter.tag } } } } });

  if (filter.branch && isBranchKey(filter.branch)) {
    const reco = BRANCH_RECOMMENDATION[filter.branch];
    and.push({
      OR: [
        { category: { is: { slug: { in: reco.categorySlugs } } } },
        { tags: { some: { tag: { is: { slug: { in: reco.tagSlugs } } } } } },
      ],
    });
  }

  return { AND: and };
}

function sortCards(cards: TrainingCardData[], sort: CatalogueFilter["sort"]): TrainingCardData[] {
  const byNext = (a: TrainingCardData, b: TrainingCardData) => {
    if (a.nextSessionAt && b.nextSessionAt) return a.nextSessionAt.localeCompare(b.nextSessionAt);
    if (a.nextSessionAt) return -1;
    if (b.nextSessionAt) return 1;
    return 0;
  };
  switch (sort) {
    case "soon":
      return [...cards].sort(byNext);
    case "free_first":
      return [...cards].sort((a, b) => {
        const af = a.priceType === "free" ? 0 : 1;
        const bf = b.priceType === "free" ? 0 : 1;
        return af - bf;
      });
    case "new":
      return cards; // déjà trié par publishedAt desc en DB
    case "recommended":
    default:
      return [...cards].sort((a, b) => {
        const score = (c: TrainingCardData) =>
          (c.isDocbelRecommended ? 2 : 0) + (c.isFeatured ? 1 : 0);
        return score(b) - score(a);
      });
  }
}

export async function listPublicTrainings(
  filter: CatalogueFilter,
  limit = 60,
): Promise<TrainingCardData[]> {
  const rows = await prisma.training.findMany({
    where: buildCatalogueWhere(filter),
    include: cardInclude,
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    take: limit,
  });
  return sortCards(rows.map(toCard), filter.sort);
}

/** Sélections de la page d'accueil catalogue (cartes prêtes à afficher). */
export async function getCatalogueSections() {
  const all = await listPublicTrainings({}, 80);
  return {
    total: all.length,
    recommended: all.filter((t) => t.isDocbelRecommended).slice(0, 6),
    free: all.filter((t) => t.priceType === "free").slice(0, 6),
    online: all.filter((t) => t.format === "online" || t.format === "hybrid").slice(0, 6),
    latest: all.slice(0, 9),
  };
}

/** Recommandations après le test Boussole (branches → catégories/tags). */
export async function getRecommendedTrainings(
  branchKeys: string[],
  limit = 6,
): Promise<TrainingCardData[]> {
  const categorySlugs = new Set<string>();
  const tagSlugs = new Set<string>();
  for (const key of branchKeys) {
    if (!isBranchKey(key)) continue;
    const reco = BRANCH_RECOMMENDATION[key];
    reco.categorySlugs.forEach((s) => categorySlugs.add(s));
    reco.tagSlugs.forEach((s) => tagSlugs.add(s));
  }
  if (categorySlugs.size === 0 && tagSlugs.size === 0) return [];

  const rows = await prisma.training.findMany({
    where: {
      status: "published",
      visibility: "public",
      OR: [
        { category: { is: { slug: { in: [...categorySlugs] } } } },
        { tags: { some: { tag: { is: { slug: { in: [...tagSlugs] } } } } } },
      ],
    },
    include: cardInclude,
    orderBy: [{ isDocbelRecommended: "desc" }, { publishedAt: "desc" }],
    take: limit,
  });
  return rows.map(toCard);
}

const detailInclude = {
  organization: true,
  category: true,
  tags: { include: { tag: true } },
  badges: { include: { badge: true } },
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

export type TrainingDetail = Prisma.TrainingGetPayload<{ include: typeof detailInclude }>;

/** Charge une formation par slug (toutes visibilités) — la page vérifie ensuite
 * canViewTraining(viewer, training). Renvoie null si introuvable. */
export async function getTrainingBySlug(slug: string): Promise<TrainingDetail | null> {
  return prisma.training.findUnique({ where: { slug }, include: detailInclude });
}

/** Places restantes d'une session (capacité - inscriptions actives). */
export function seatsLeft(
  session: { capacity: number | null; _count: { enrollments: number } },
): number | null {
  if (session.capacity == null) return null;
  return Math.max(0, session.capacity - session._count.enrollments);
}

export async function listActiveCategories() {
  const cats = await prisma.trainingCategory.findMany({
    where: { isActive: true },
    orderBy: { order: "asc" },
  });
  return cats.map((c) => ({
    slug: c.slug,
    name: c.name,
    color: c.color,
    icon: c.icon,
  }));
}

export async function listOrientationTags() {
  return prisma.trainingTag.findMany({
    where: { isOrientationTag: true },
    orderBy: { name: "asc" },
    select: { slug: true, name: true },
  });
}
