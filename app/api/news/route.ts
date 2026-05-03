import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logActivity } from '@/lib/activity-logger';
import { requireAdminAuth } from '@/lib/auth-check';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || 'all';
    const category = searchParams.get('category') || 'all';
    const featured = searchParams.get('featured');
    const search = searchParams.get('search') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    const skip = (page - 1) * limit;

    // Build filter
    const where: any = {};

    if (status !== 'all') {
      where.status = status;
    }

    if (category !== 'all') {
      where.category = category;
    }

    if (featured === 'true') {
      where.featured = true;
    }

    if (search) {
      where.OR = [
        { title: { contains: search } },
        { excerpt: { contains: search } },
        { content: { contains: search } }
      ];
    }

    // Build sort - support: title, status, createdAt, views, publishedAt
    const orderBy: any = {};
    const validSortFields = ['title', 'status', 'createdAt', 'views', 'publishedAt'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
    const order = sortOrder === 'asc' ? 'asc' : 'desc';
    orderBy[sortField] = order;

    // Build where without status for cross-tab counts
    const whereWithoutStatus = { ...where };
    delete whereWithoutStatus.status;

    // Fetch articles, categories, and per-status counts
    const [articles, total, categories, statusGroups] = await Promise.all([
      prisma.news.findMany({
        where,
        orderBy,
        skip,
        take: limit
      }),
      prisma.news.count({ where }),
      prisma.category.findMany(),
      prisma.news.groupBy({
        by: ['status'],
        where: whereWithoutStatus,
        _count: { status: true }
      })
    ]);

    const statusCounts: Record<string, number> = { all: 0 };
    statusGroups.forEach(g => {
      statusCounts[g.status] = g._count.status;
      statusCounts.all = (statusCounts.all || 0) + g._count.status;
    });

    // Fetch image fields via raw SQL (Prisma client may predate the migration)
    let imageMap: Record<string, string | null> = {};
    if (articles.length > 0) {
      const ids = articles.map(a => a.id);
      const placeholders = ids.map(() => '?').join(',');
      const imageRows = await prisma.$queryRawUnsafe<{ id: string; image: string | null }[]>(
        `SELECT "id", "image" FROM "News" WHERE "id" IN (${placeholders})`,
        ...ids
      );
      imageRows.forEach(row => { imageMap[row.id] = row.image; });
    }

    // Create category color map
    const categoryColorMap: Record<string, string> = {};
    categories.forEach(cat => {
      categoryColorMap[cat.name] = cat.color;
    });

    // Add category color and image to articles
    const articlesWithCategoryColor = articles.map(article => ({
      ...article,
      image: imageMap[article.id] ?? null,
      categoryColor: categoryColorMap[article.category] || '#C8102E'
    }));

    return NextResponse.json({
      articles: articlesWithCategoryColor,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      statusCounts
    }, {
      headers: {
        'Content-Type': 'application/json; charset=utf-8'
      }
    });
  } catch (error) {
    console.error('Error fetching news:', error);
    return NextResponse.json({ error: 'Failed to fetch news' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const authCheck = await requireAdminAuth()
  if (!authCheck.isAuthorized) return authCheck.error

  try {
    const body = await req.json();
    const { title, slug, excerpt, content, category, color, emoji, image, status, featured, scheduledAt, readingTime } = body;

    if (!title || !slug || !excerpt || !content || !category) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Calculate reading time if not provided
    const calcReadingTime = readingTime || Math.max(1, Math.ceil(
      content.replace(/<[^>]+>/g, '').trim().split(/\s+/).length / 200
    ));

    const article = await prisma.news.create({
      data: {
        title,
        slug,
        excerpt,
        content,
        category,
        color: color || '#C8102E',
        emoji: emoji || '📰',
        status: status || 'draft',
        featured: featured || false,
        readingTime: calcReadingTime,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        createdBy: 'admin'
      }
    });

    // Set image via raw SQL (Prisma client may predate the migration)
    if (image) {
      await prisma.$executeRaw`UPDATE "News" SET "image" = ${image} WHERE "id" = ${article.id}`;
    }

    await logActivity('Admin', 'created', 'news', title, article.id, `Article créé: ${title}`);

    return NextResponse.json({ ...article, image: image || null }, {
      status: 201,
      headers: {
        'Content-Type': 'application/json; charset=utf-8'
      }
    });
  } catch (error) {
    console.error('Error creating news:', error);
    return NextResponse.json({ error: 'Failed to create news' }, { status: 500 });
  }
}
