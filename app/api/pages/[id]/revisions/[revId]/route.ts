import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminAuth } from '@/lib/auth-check'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; revId: string }> }
) {
  const auth = await requireAdminAuth()
  if (!auth.isAuthorized) return auth.error

  try {
    const { id, revId } = await params
    const rev = await prisma.pageRevision.findFirst({
      where: { id: revId, pageId: id },
    })
    if (!rev) {
      return NextResponse.json({ error: 'Revision not found' }, { status: 404 })
    }
    return NextResponse.json({ ...rev, blocks: rev.content })
  } catch (error) {
    console.error('GET /api/pages/[id]/revisions/[revId] error:', error)
    return NextResponse.json({ error: 'Failed to fetch revision' }, { status: 500 })
  }
}
