import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/auth-check'
import { approveBaremeImport } from '@/lib/baremes/approveBaremeImport'
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
    const body = (await req.json().catch(() => ({}))) as { comment?: string }

    const result = await approveBaremeImport(id, {
      approverEmail: auth.user.email,
      approverName: auth.user.name,
      comment: body.comment ?? null,
    })

    if (result.status === 'error') {
      return NextResponse.json(
        { error: result.message },
        { status: 400, headers: jsonHeaders }
      )
    }

    if (result.status === 'already_approved') {
      return NextResponse.json(
        { status: 'already_approved', approvalsCount: result.approvalsCount },
        { status: 409, headers: jsonHeaders }
      )
    }

    await logActivity(
      auth.user.email,
      'updated',
      'file',
      `bareme-${id}`,
      id,
      result.autoPublished
        ? `Approbation enregistrée — auto-publication (${result.approvalsCount}/${result.requiredCount})`
        : `Approbation enregistrée (${result.approvalsCount}/${result.requiredCount})`
    )

    return NextResponse.json(result, { headers: jsonHeaders })
  } catch (err) {
    console.error('[baremes/import/[id]/approve] error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500, headers: jsonHeaders }
    )
  }
}
