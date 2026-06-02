import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireAdminAuth } from '@/lib/auth-check'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authCheck = await requireAdminAuth()
  if (!authCheck.isAuthorized) return authCheck.error

  try {
    const { id } = await params
    await prisma.snippet.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2025'
    ) {
      return NextResponse.json({ error: 'Snippet not found' }, { status: 404 })
    }
    console.error('DELETE /api/page-builder/snippets/[id] error:', error)
    return NextResponse.json({ error: 'Failed to delete snippet' }, { status: 500 })
  }
}
