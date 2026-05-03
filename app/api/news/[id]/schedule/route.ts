import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logActivity } from '@/lib/activity-logger';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { scheduledAt } = body;

    if (!scheduledAt) {
      return NextResponse.json({ error: 'scheduledAt is required' }, { status: 400 });
    }

    const article = await prisma.news.update({
      where: { id },
      data: {
        status: 'scheduled',
        scheduledAt: new Date(scheduledAt)
      }
    });

    await logActivity('Admin', 'scheduled', 'news', article.title, article.id, `Article planifié pour: ${article.scheduledAt}`);

    return NextResponse.json(article, {
      headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
  } catch (error) {
    console.error('Error scheduling article:', error);
    return NextResponse.json({ error: 'Failed to schedule article' }, { status: 500 });
  }
}
