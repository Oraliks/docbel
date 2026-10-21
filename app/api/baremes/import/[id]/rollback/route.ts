import { NextRequest } from 'next/server'
import { apiError, apiOk } from '@/lib/api/response'
import { requireAdminAuth } from '@/lib/auth-check'
import { ensureWriteAllowed } from '@/lib/admin/readonly-guard'
import { rollbackToVersion } from '@/lib/baremes/publishBaremeImport'
import { logActivity } from '@/lib/activity-logger'

export const runtime = 'nodejs'


export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminAuth()
  if (!auth.isAuthorized) return auth.error

  const writeGuard = await ensureWriteAllowed()
  if (writeGuard) return writeGuard

  try {
    const { id } = await params
    const result = await rollbackToVersion(id, auth.user.email)

    if (result.status === 'error') {
      return apiError(400, result.message)
    }

    await logActivity(
      auth.user.name,
      'published',
      'file',
      `bareme-${id}`,
      id,
      `Rollback vers version archivée (versions retirées : ${result.revokedFileIds.join(', ') || 'aucune'})`
    )

    return apiOk(result)
  } catch (err) {
    console.error('[baremes/import/[id]/rollback] error:', err)
    return apiError(500, 'Internal error')
  }
}
