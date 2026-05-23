import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/auth-check'
import { rejectBaremeImport } from '@/lib/baremes/publishBaremeImport'
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
    const result = await rejectBaremeImport(id, auth.user.email)

    if (result.status === 'error') {
      return NextResponse.json(
        { error: result.message },
        { status: 400, headers: jsonHeaders }
      )
    }

    await logActivity(
      auth.user.email,
      'updated',
      'file',
      `bareme-${id}`,
      id,
      'Import barème rejeté'
    )

    return NextResponse.json({ status: 'rejected' }, { headers: jsonHeaders })
  } catch (err) {
    console.error('[baremes/import/[id]/reject] error:', err)
    const message = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json(
      { error: message },
      { status: 500, headers: jsonHeaders }
    )
  }
}
