import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/auth-check'
import { rollbackToVersion } from '@/lib/baremes/publishBaremeImport'
import { logActivity } from '@/lib/activity-logger'

export const runtime = 'nodejs'
const jsonHeaders = { 'Content-Type': 'application/json; charset=utf-8' }

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminAuth()
  if (!auth.isAuthorized) return auth.error

  try {
    const { id } = await params
    const result = await rollbackToVersion(id, auth.user.email)

    if (result.status === 'error') {
      return NextResponse.json(
        { error: result.message },
        { status: 400, headers: jsonHeaders }
      )
    }

    await logActivity(
      auth.user.email,
      'published',
      'file',
      `bareme-${id}`,
      id,
      `Rollback vers version archivée${result.archivedPreviousId ? ` (publié actuel archivé: ${result.archivedPreviousId})` : ''}`
    )

    return NextResponse.json(
      { status: 'rolled_back', archivedPreviousId: result.archivedPreviousId },
      { headers: jsonHeaders }
    )
  } catch (err) {
    console.error('[baremes/import/[id]/rollback] error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500, headers: jsonHeaders }
    )
  }
}
