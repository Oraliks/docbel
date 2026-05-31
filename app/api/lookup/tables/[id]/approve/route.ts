import { NextRequest, NextResponse } from 'next/server'
import { prisma, withDbRetry } from '@/lib/prisma'
import { requireAdminAuth } from '@/lib/auth-check'
import { REQUIRED_APPROVALS } from '@/lib/lookup/approvals'

export const runtime = 'nodejs'
const jsonHeaders = { 'Content-Type': 'application/json; charset=utf-8' }

/**
 * Enregistre une approbation pour une LookupTable sensible (requiresApproval=true).
 * Un même approbateur ne peut approuver qu'une fois (contrainte unique).
 * Quand REQUIRED_APPROVALS distinctes sont atteintes, l'import est autorisé.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminAuth()
  if (!auth.isAuthorized) return auth.error

  try {
    const { id } = await params
    const body = (await req.json().catch(() => ({}))) as { comment?: string }

    const table = await withDbRetry(() =>
      prisma.lookupTable.findUnique({
        where: { id },
        select: {
          id: true,
          requiresApproval: true,
          approvals: { select: { approverEmail: true } },
        },
      })
    )
    if (!table) {
      return NextResponse.json({ error: 'Table introuvable' }, { status: 404, headers: jsonHeaders })
    }
    if (!table.requiresApproval) {
      return NextResponse.json(
        { error: 'Cette table ne requiert pas d\'approbation' },
        { status: 400, headers: jsonHeaders }
      )
    }

    if (table.approvals.some((a) => a.approverEmail === auth.user.email)) {
      return NextResponse.json(
        { status: 'already_approved', count: table.approvals.length },
        { status: 409, headers: jsonHeaders }
      )
    }

    await withDbRetry(() =>
      prisma.lookupApproval.create({
        data: {
          tableId: id,
          approverEmail: auth.user.email,
          approverName: auth.user.name,
          comment: body.comment ?? null,
        },
      })
    )

    const count = table.approvals.length + 1
    return NextResponse.json(
      {
        status: 'recorded',
        count,
        required: REQUIRED_APPROVALS,
        canImport: count >= REQUIRED_APPROVALS,
      },
      { headers: jsonHeaders }
    )
  } catch (err) {
    console.error('[lookup approve] error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500, headers: jsonHeaders }
    )
  }
}

/**
 * Reset des approbations (utilisé après un import réussi pour repartir à zéro
 * pour la prochaine modification).
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminAuth()
  if (!auth.isAuthorized) return auth.error

  const { id } = await params
  await withDbRetry(() => prisma.lookupApproval.deleteMany({ where: { tableId: id } }))
  return NextResponse.json({ status: 'reset' }, { headers: jsonHeaders })
}
