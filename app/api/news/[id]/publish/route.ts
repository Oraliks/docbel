import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logActivity } from '@/lib/activity-logger';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const article = await prisma.news.update({
      where: { id },
      data: {
        status: 'published',
        publishedAt: new Date(),
        scheduledAt: null
      }
    });

    await logActivity('Admin', 'published', 'news', article.title, article.id, `Article publié: ${article.title}`);

    return NextResponse.json(article, {
      headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
  } catch (error) {
    console.error('Error publishing article:', error);
    return NextResponse.json({ error: 'Failed to publish article' }, { status: 500 });
  }
}
