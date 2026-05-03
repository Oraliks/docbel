import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminAuth } from '@/lib/auth-check'
import { logActivity } from '@/lib/activity-logger'
import { unlink } from 'fs/promises'
import path from 'path'

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminAuth()
  if (!auth.isAuthorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id } = await params

    const file = await prisma.baremeFile.findUnique({ where: { id } })
    if (!file) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
      )
    }

    // Supprimer le fichier physique
    try {
      const fullPath = path.join(process.cwd(), 'public', file.filePath)
      await unlink(fullPath)
    } catch (e) {
      // Continuer même si le fichier physique n'existe plus
    }

    // Supprimer en cascade (sheets liées via onDelete: Cascade)
    await prisma.baremeFile.delete({ where: { id } })

    await logActivity(
      auth.user?.email || 'unknown',
      'deleted',
      'baremes',
      file.name,
      id
    )

    return NextResponse.json(
      { success: true },
      { headers: { 'Content-Type': 'application/json; charset=utf-8' } }
    )
  } catch (error) {
    console.error('DELETE error:', error)
    return NextResponse.json(
      { error: 'Failed to delete' },
      { status: 500, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
    )
  }
}
