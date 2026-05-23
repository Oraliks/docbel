import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/auth-check'
import { publishBaremeImport } from '@/lib/baremes/publishBaremeImport'
import { logActivity } from '@/lib/activity-logger'

export const runtime = 'nodejs'
const jsonHeaders = { 'Content-Type': 'application/json; charset=utf-8' }

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminAuth()
  if (!auth.isAuthorized) return auth.error

  try {
    const { id } = await params
    const body = (await req.json().catch(() => ({}))) as { force?: boolean }

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
