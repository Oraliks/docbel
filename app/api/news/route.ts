import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-logger";
import { requireAdminAuth } from "@/lib/auth-check";
import { getCurrentUser, actorLabel } from "@/lib/news/session";
import { newsCreateSchema, newsListQuerySchema } from "@/lib/news/validation";
import { slugify } from "@/lib/news/slug";
import { HERO_REQUIRED_MESSAGE, hasHeroIllustration } from "@/lib/news/publish-guard";

const PUBLIC_LIST_FIELDS = {
  id: true,
  title: true,
  slug: true,
  excerpt: true,
  category: true,
  color: true,
  emoji: true,
  status: true,
  featured: true,
  image: true,
  readingTime: true,
  views: true,
  publishedAt: true,
  scheduledAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

// NB : `content` (HTML complet de l'article) est volontairement EXCLU de la
// liste admin — la liste ne l'affiche pas, seul l'éditeur en a besoin (chargé
// via /api/news/[newsId]). Évite de transférer le corps de chaque article.
const ADMIN_LIST_FIELDS = {
  ...PUBLIC_LIST_FIELDS,
  createdBy: true,
  updatedBy: true,
} as const;

const jsonHeaders = { "Content-Type": "application/json; charset=utf-8" };

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const parsed = newsListQuerySchema.safeParse(Object.fromEntries(searchParams));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid query parameters", issues: parsed.error.issues },
        { status: 400, headers: jsonHeaders }
      );
    }

    const { status, category, featured, search, page, limit, sortBy, sortOrder } = parsed.data;
    const currentUser = await getCurrentUser();
    const isAdmin = currentUser?.isAdmin === true;

    const where: Prisma.NewsWhereInput = {};

    if (isAdmin) {
      if (status !== "all") where.status = status;
    } else {
      // Public: only published. The status filter is ignored for non-admin clients.
      where.status = "published";
    }

    if (category !== "all") where.category = category;
    if (featured === "true") where.featured = true;

    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { excerpt: { contains: search, mode: "insensitive" } },
        { content: { contains: search, mode: "insensitive" } },
      ];
    }

    const orderBy: Prisma.NewsOrderByWithRelationInput = { [sortBy]: sortOrder };
    const skip = (page - 1) * limit;
    const select = isAdmin ? ADMIN_LIST_FIELDS : PUBLIC_LIST_FIELDS;

    // Status counts only meaningful for admins.
    const whereForCounts: Prisma.NewsWhereInput = { ...where };
    delete whereForCounts.status;

    const [articles, total, categories, statusGroups] = await Promise.all([
      prisma.news.findMany({ where, orderBy, skip, take: limit, select }),
      prisma.news.count({ where }),
      prisma.category.findMany({ select: { name: true, color: true } }),
      isAdmin
        ? prisma.news.groupBy({
            by: ["status"],
            where: whereForCounts,
            _count: { status: true },
          })
        : Promise.resolve([] as { status: string; _count: { status: number } }[]),
    ]);

    const statusCounts: Record<string, number> = { all: 0 };
    for (const group of statusGroups) {
      statusCounts[group.status] = group._count.status;
      statusCounts.all += group._count.status;
    }

    const colorMap = new Map(categories.map((c) => [c.name, c.color]));
    const articlesWithCategoryColor = articles.map((article) => ({
      ...article,
      categoryColor: colorMap.get(article.category) ?? "#7C3AED",
    }));

    return NextResponse.json(
      {
        articles: articlesWithCategoryColor,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        statusCounts,
      },
      { headers: jsonHeaders }
    );
  } catch (error) {
    console.error("Error fetching news:", error);
    return NextResponse.json({ error: "Failed to fetch news" }, { status: 500, headers: jsonHeaders });
  }
}

export async function POST(req: NextRequest) {
  const authCheck = await requireAdminAuth();
  if (!authCheck.isAuthorized) return authCheck.error;

  try {
    const json = await req.json();
    const parsed = newsCreateSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", issues: parsed.error.issues },
        { status: 400, headers: jsonHeaders }
      );
    }
    const data = parsed.data;
    const slug = slugify(data.slug) || slugify(data.title);
    if (!slug) {
      return NextResponse.json({ error: "Slug invalide" }, { status: 400, headers: jsonHeaders });
    }

    const slugConflict = await prisma.news.findUnique({ where: { slug }, select: { id: true } });
    if (slugConflict) {
      return NextResponse.json(
        { error: "Un article avec ce slug existe déjà" },
        { status: 409, headers: jsonHeaders }
      );
    }

    if (data.status === "scheduled") {
      if (!data.scheduledAt || new Date(data.scheduledAt).getTime() <= Date.now()) {
        return NextResponse.json(
          { error: "scheduledAt doit être dans le futur" },
          { status: 400, headers: jsonHeaders }
        );
      }
    }

    // Garde : créer directement un article en ligne (publié/planifié) exige
    // une illustration de hero.
    if (
      (data.status === "published" || data.status === "scheduled") &&
      !hasHeroIllustration(data.heroIllustration)
    ) {
      return NextResponse.json({ error: HERO_REQUIRED_MESSAGE }, { status: 422, headers: jsonHeaders });
    }

    const plainText = data.content.replace(/<[^>]+>/g, "").trim();
    const wordCount = plainText.length > 0 ? plainText.split(/\s+/).length : 0;
    const calcReadingTime = data.readingTime || Math.max(1, Math.ceil(wordCount / 200));

    const article = await prisma.news.create({
      data: {
        title: data.title,
        slug,
        excerpt: data.excerpt,
        content: data.content,
        category: data.category,
        color: data.color || "#7C3AED",
        emoji: data.emoji || "📰",
        status: data.status || "draft",
        featured: data.featured ?? false,
        image: data.image || null,
        heroIllustration: data.heroIllustration ?? null,
        readingTime: calcReadingTime,
        scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
        keyTakeaway: data.keyTakeaway ?? null,
        // Colonnes JSONB : Prisma refuse un null brut → Prisma.JsonNull pour vider.
        summary: data.summary ?? Prisma.JsonNull,
        linkedDocs: data.linkedDocs ?? Prisma.JsonNull,
        faqs: data.faqs ?? Prisma.JsonNull,
        createdBy: authCheck.user?.id || "unknown",
        updatedBy: authCheck.user?.id || null,
      },
    });

    await logActivity(
      actorLabel(authCheck.user),
      "created",
      "news",
      article.title,
      article.id,
      `Article créé: ${article.title}`
    );

    return NextResponse.json(article, { status: 201, headers: jsonHeaders });
  } catch (error) {
    console.error("Error creating news:", error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        { error: "Un article avec ce slug existe déjà" },
        { status: 409, headers: jsonHeaders }
      );
    }
    return NextResponse.json({ error: "Failed to create news" }, { status: 500, headers: jsonHeaders });
  }
}
