import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logActivity } from '@/lib/activity-logger';
import { requireAdminAuth } from '@/lib/auth-check';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const article = await prisma.news.findUnique({
      where: { id }
    });

    if (!article) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 });
    }

    const imageRow = await prisma.$queryRaw<{ image: string | null }[]>`SELECT "image" FROM "News" WHERE "id" = ${id}`;
    const storedImage = imageRow[0]?.image ?? null;

    return NextResponse.json({ ...article, image: storedImage }, {
      headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
  } catch (error) {
    console.error('Error fetching article:', error);
    return NextResponse.json({ error: 'Failed to fetch article' }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authCheck = await requireAdminAuth()
  if (!authCheck.isAuthorized) return authCheck.error

  try {
    const { id } = await params;
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
      publishedAt,
      readingTime
    } = body;

    const article = await prisma.news.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(slug !== undefined && { slug }),
        ...(excerpt !== undefined && { excerpt }),
        ...(content !== undefined && { content }),
        ...(category !== undefined && { category }),
        ...(color !== undefined && { color }),
        ...(emoji !== undefined && { emoji }),
        ...(status !== undefined && { status }),
        ...(featured !== undefined && { featured }),
        ...(readingTime !== undefined && { readingTime }),
        ...(scheduledAt !== undefined && { scheduledAt: scheduledAt ? new Date(scheduledAt) : null }),
        ...(publishedAt !== undefined && { publishedAt: publishedAt ? new Date(publishedAt) : null })
      }
    });

    // Set image via raw SQL (Prisma client may predate the migration)
    if (image !== undefined) {
      await prisma.$executeRaw`UPDATE "News" SET "image" = ${image || null} WHERE "id" = ${id}`;
    }

    // Fetch the stored image to include in response
    const imageRow = await prisma.$queryRaw<{ image: string | null }[]>`SELECT "image" FROM "News" WHERE "id" = ${id}`;
    const storedImage = imageRow[0]?.image ?? null;

    await logActivity('Admin', 'updated', 'news', article.title, article.id, `Article mis à jour: ${article.title}`);

    return NextResponse.json({ ...article, image: storedImage }, {
      headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
  } catch (error) {
    console.error('Error updating article:', error);
    return NextResponse.json({ error: 'Failed to update article' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authCheck = await requireAdminAuth()
  if (!authCheck.isAuthorized) return authCheck.error

  try {
    const { id } = await params;
    const article = await prisma.news.findUnique({
      where: { id }
    });

    if (!article) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 });
    }

    await prisma.news.delete({
      where: { id }
    });

    await logActivity('Admin', 'deleted', 'news', article.title, article.id, `Article supprimé: ${article.title}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting article:', error);
    return NextResponse.json({ error: 'Failed to delete article' }, { status: 500 });
  }
}
