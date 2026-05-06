import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-logger";
import { requireAdminAuth } from "@/lib/auth-check";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || "all";
    const category = searchParams.get("category") || "all";
    const featured = searchParams.get("featured");
    const search = searchParams.get("search") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const sortBy = searchParams.get("sortBy") || "createdAt";
    const sortOrder = searchParams.get("sortOrder") || "desc";

    const skip = (page - 1) * limit;
    const where: Record<string, unknown> = {};

    if (status !== "all") {
      where.status = status;
    }

    if (category !== "all") {
      where.category = category;
    }

    if (featured === "true") {
      where.featured = true;
    }

    if (search) {
      where.OR = [
        { title: { contains: search } },
        { excerpt: { contains: search } },
        { content: { contains: search } },
      ];
    }

    const validSortFields = ["title", "status", "createdAt", "views", "publishedAt"];
    const sortField = validSortFields.includes(sortBy) ? sortBy : "createdAt";
    const orderBy: Record<string, "asc" | "desc"> = {
      [sortField]: sortOrder === "asc" ? "asc" : "desc",
    };

    const whereWithoutStatus = { ...where };
    delete whereWithoutStatus.status;

    const [articles, total, categories, statusGroups] = await Promise.all([
      prisma.news.findMany({
        where,
        orderBy,
        skip,
        take: limit,
      }),
      prisma.news.count({ where }),
      prisma.category.findMany(),
      prisma.news.groupBy({
        by: ["status"],
        where: whereWithoutStatus,
        _count: { status: true },
      }),
    ]);

    const statusCounts: Record<string, number> = { all: 0 };
    statusGroups.forEach((group) => {
      statusCounts[group.status] = group._count.status;
      statusCounts.all += group._count.status;
    });

    const categoryColorMap: Record<string, string> = {};
    categories.forEach((cat) => {
      categoryColorMap[cat.name] = cat.color;
    });

    const articlesWithCategoryColor = articles.map((article) => ({
      ...article,
      categoryColor: categoryColorMap[article.category] || "#C8102E",
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
      {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
        },
      }
    );
  } catch (error) {
    console.error("Error fetching news:", error);
    return NextResponse.json({ error: "Failed to fetch news" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const authCheck = await requireAdminAuth();
  if (!authCheck.isAuthorized) return authCheck.error;

  try {
    const body = await req.json();
    const {
      title,
      slug,
      excerpt,
      content,
      category,
      color,
      emoji,
      image,
      status,
      featured,
      scheduledAt,
      readingTime,
    } = body;

    if (!title || !slug || !excerpt || !content || !category) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const calcReadingTime =
      readingTime ||
      Math.max(1, Math.ceil(content.replace(/<[^>]+>/g, "").trim().split(/\s+/).length / 200));

    const article = await prisma.news.create({
      data: {
        title,
        slug,
        excerpt,
        content,
        category,
        color: color || "#C8102E",
        emoji: emoji || "📰",
        status: status || "draft",
        featured: featured || false,
        image: image || null,
        readingTime: calcReadingTime,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        createdBy: authCheck.user?.id || "unknown",
      },
    });

    const actorName = authCheck.user?.name || authCheck.user?.email || "Admin";
    await logActivity(actorName, "created", "news", title, article.id, `Article cree: ${title}`);

    return NextResponse.json(article, {
      status: 201,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
      },
    });
  } catch (error) {
    console.error("Error creating news:", error);
    return NextResponse.json({ error: "Failed to create news" }, { status: 500 });
  }
}
