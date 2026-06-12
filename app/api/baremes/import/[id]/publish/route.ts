import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdminAuth } from '@/lib/auth-check'
import { ensureWriteAllowed } from '@/lib/admin/readonly-guard'
import { publishBaremeImport } from '@/lib/baremes/publishBaremeImport'
import { logActivity } from '@/lib/activity-logger'

export const runtime = 'nodejs'
const jsonHeaders = { 'Content-Type': 'application/json; charset=utf-8' }

const bodySchema = z.object({ force: z.boolean().optional() }).default({})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminAuth()
  if (!auth.isAuthorized) return auth.error

  const writeGuard = await ensureWriteAllowed()
  if (writeGuard) return writeGuard

  try {
    const { id } = await params
    const parsedBody = bodySchema.safeParse(await req.json().catch(() => ({})))
    if (!parsedBody.success) {
      return NextResponse.json(
        { error: 'Body invalide' },
        { status: 400, headers: jsonHeaders }
      )
    }
    const body = parsedBody.data

    const result = await publishBaremeImport(id, {
      publishedBy: auth.user.email,
      force: body.force === true,
    })

    if (result.status === 'error') {
      const httpStatus =
        result.reason === 'not_found' ? 404 : result.reason === 'has_errors' ? 422 : 400
      return NextResponse.json(
        { error: result.message, reason: result.reason },
        { status: httpStatus, headers: jsonHeaders }
      )
    }

    await logActivity(
      auth.user.email,
      'published',
      'file',
      `bareme-${id}`,
      id,
      result.archivedPreviousId
        ? `Publié (précédent archivé: ${result.archivedPreviousId})`
        : 'Publié (aucun précédent)'
    )

    return NextResponse.json(
      {
        status: 'published',
        fileId: result.fileId,
        archivedPreviousId: result.archivedPreviousId,
      },
      { headers: jsonHeaders }
    )
  } catch (err) {
    console.error('[baremes/import/[id]/publish] error:', err)
    const message = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json(
      { error: message },
      { status: 500, headers: jsonHeaders }
    )
  }
}
