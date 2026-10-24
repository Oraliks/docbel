import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireAdminAuth } from '@/lib/auth-check'
import { ensureWriteAllowed } from '@/lib/admin/readonly-guard'
import { resumeRejectedBaremeImport } from '@/lib/baremes/resumeRejectedBaremeImport'
import { logActivity } from '@/lib/activity-logger'
import { apiError, apiOk } from '@/lib/api/response'

export const runtime = 'nodejs'
const bodySchema = z.object({ reason: z.string().trim().min(20).max(500) })

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminAuth()
  if (!auth.isAuthorized) return auth.error
  const guard = await ensureWriteAllowed()
  if (guard) return guard
  const body = bodySchema.safeParse(await req.json().catch(() => null))
  if (!body.success) return apiError(400, 'Une justification de 20 à 500 caractères est requise.')
  try {
    const { id } = await params
    const result = await resumeRejectedBaremeImport(id, auth.user.email, body.data.reason)
    if (result.status === 'error') {
      const status = result.reason === 'not_found' ? 404 : result.reason === 'unavailable' ? 422 : 409
      return apiError(status, result.message, { code: result.reason })
    }
    await logActivity(auth.user.email, 'updated', 'file', `bareme-${id}`, id, 'Import barème rejeté repris en brouillon').catch((error) => {
      console.warn('[baremes/import/[id]/resume] activity log unavailable; primary audit event committed:', error)
    })
    return apiOk({ status: 'resumed' })
  } catch (error) {
    console.error('[baremes/import/[id]/resume] error:', error)
    return apiError(500, error instanceof Error ? error.message : 'Internal error')
  }
}
