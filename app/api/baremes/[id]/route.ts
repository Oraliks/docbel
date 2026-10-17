import { NextRequest, NextResponse } from 'next/server'
import { prisma, withDbRetry } from '@/lib/prisma'
import { requireAdminAuth } from '@/lib/auth-check'
import { ensureWriteAllowed } from '@/lib/admin/readonly-guard'
import { logActivity } from '@/lib/activity-logger'
import { unlink } from 'fs/promises'
import path from 'path'
import { deleteBlob, isBlobsPath } from '@/lib/storage/blob-storage'
import { apiError, apiOk } from '@/lib/api/response'

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminAuth()
  if (!auth.isAuthorized) {
    return auth.error
  }

  const writeGuard = await ensureWriteAllowed()
  if (writeGuard) return writeGuard

  try {
    const { id } = await params

    const file = await prisma.baremeFile.findUnique({ where: { id } })
    if (!file) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
      )
    }

    if (!['draft', 'pending_approval', 'rejected', 'deleting'].includes(file.status)) {
      return apiError(409, 'La source d’une version publiée ou archivée doit être conservée.', { code: 'protected_version' })
    }
    // Transition durable avant le stockage : une publication concurrente ne peut
    // pas exploiter une source en cours de suppression. Une panne reste réessayable.
    const claimed = await withDbRetry(() => prisma.baremeFile.updateMany({
      where: { id, status: file.status, filePath: file.filePath }, data: { status: 'deleting' },
    }))
    if (claimed.count !== 1) return apiError(409, 'L’import a changé : actualiser puis réessayer.')
    try {
      if (isBlobsPath(file.filePath)) {
        await deleteBlob(file.filePath)
      } else if (file.filePath) {
        const relative = file.filePath.replace(/^\//, '')
        const fullPath = path.resolve(relative.startsWith('uploads/') ? path.join(process.cwd(), 'public') : process.cwd(), relative)
        const roots = [path.resolve(process.cwd(), 'private', 'uploads', 'baremes'), path.resolve(process.cwd(), 'public', 'uploads', 'baremes')]
        if (!roots.some((root) => fullPath.startsWith(root + path.sep))) throw new Error('Invalid legacy source path')
        try { await unlink(fullPath) } catch (error) {
          if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error
        }
      }
    } catch (error) {
      console.error('[baremes/delete] source cleanup failed:', error)
      return apiError(502, 'Suppression de la source impossible. La fiche est conservée en attente de suppression ; réessayez.', { code: 'source_cleanup_failed' })
    }

    // Supprimer en cascade (sheets liées via onDelete: Cascade)
    const removed = await withDbRetry(() => prisma.baremeFile.deleteMany({ where: { id, status: 'deleting', filePath: file.filePath } }))

    if (removed.count > 0) await logActivity(
      auth.user?.email || 'unknown',
      'deleted',
      'file',
      file.name,
      id
    )

    return apiOk({ success: true })
  } catch (error) {
    console.error('DELETE error:', error)
    return NextResponse.json(
      { error: 'Failed to delete' },
      { status: 500, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
    )
  }
}
