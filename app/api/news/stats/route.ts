import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";

const jsonHeaders = { "Content-Type": "application/json; charset=utf-8" };

export async function GET() {
  const authCheck = await requireAdminAuth();
  if (!authCheck.isAuthorized) return authCheck.error;

  try {
    const [statusGroups, viewsAgg, byCategoryRaw, mostViewed, leastViewedPublished, recentArticles] =
      await Promise.all([
        prisma.news.groupBy({
          by: ["status"],
          _count: { _all: true },
        }),
        prisma.news.aggregate({ _sum: { views: true }, _avg: { views: true }, _count: { _all: true } }),
        prisma.news.groupBy({
          by: ["category"],
          _count: { _all: true },
          _sum: { views: true },
          orderBy: { _sum: { views: "desc" } },
        }),
        prisma.news.findFirst({
          orderBy: { views: "desc" },
          select: { id: true, title: true, views: true, category: true, emoji: true },
        }),
        prisma.news.findFirst({
          where: { status: "published" },
          orderBy: { views: "asc" },
          select: { id: true, title: true, views: true, category: true, emoji: true },
        }),
        prisma.news.findMany({
          orderBy: { createdAt: "desc" },
          take: 5,
          select: { id: true, title: true, status: true, views: true, createdAt: true },
        }),
      ]);

    const byStatus: Record<string, number> = { published: 0, draft: 0, scheduled: 0, archived: 0 };
    for (const group of statusGroups) {
      byStatus[group.status] = group._count._all;
    }

    const total = viewsAgg._count._all ?? 0;
    const totalViews = viewsAgg._sum.views ?? 0;
    const avgViews = total > 0 ? Math.round(viewsAgg._avg.views ?? 0) : 0;

    return NextResponse.json(
      {
        total,
        published: byStatus.published,
        draft: byStatus.draft,
        scheduled: byStatus.scheduled,
        archived: byStatus.archived,
        totalViews,
        avgViews,
        mostViewed,
        leastViewed: leastViewedPublished,
        byCategory: byCategoryRaw.map((row) => ({
          category: row.category,
          count: row._count._all,
          views: row._sum.views ?? 0,
        })),
        recentArticles,
      },
      { headers: jsonHeaders }
    );
  } catch (error) {
    console.error("Error fetching news stats:", error);
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500, headers: jsonHeaders });
  }
}
