import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminAuth } from '@/lib/auth-check'

const DEFAULT_LIMIT = 30
const MAX_LIMIT = 100

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminAuth()
  if (!auth.isAuthorized) return auth.error

  try {
    const { id } = await params
    const { searchParams } = new URL(req.url)
    const limit = Math.min(
      MAX_LIMIT,
      Math.max(1, Number(searchParams.get('limit')) || DEFAULT_LIMIT)
    )

    const revisions = await prisma.pageRevision.findMany({
      where: { pageId: id },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        title: true,
        metaTitle: true,
        metaDesc: true,
        ogImage: true,
        createdBy: true,
        createdAt: true,
      },
    })

    return NextResponse.json({ items: revisions })
  } catch (error) {
    console.error('GET /api/pages/[id]/revisions error:', error)
    return NextResponse.json({ error: 'Failed to fetch revisions' }, { status: 500 })
  }
}
