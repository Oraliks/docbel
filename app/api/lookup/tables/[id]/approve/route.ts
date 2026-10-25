import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireAdminAuth } from '@/lib/auth-check'
import { REQUIRED_APPROVALS } from '@/lib/lookup/approvals'
import { z } from 'zod'

export const runtime = 'nodejs'
const jsonHeaders = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'private, no-store',
}

/**
 * Enregistre une approbation liée à une proposition immuable.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminAuth()
  if (!auth.isAuthorized) return auth.error

  try {
    const { id } = await params
    const bodySchema = z.object({
      proposalId: z.string().min(1).max(100),
      comment: z.string().trim().max(1000).optional(),
    })
    const rawBody = await req.json()
    const parsedBody = bodySchema.safeParse(rawBody)
    if (!parsedBody.success) {
      return NextResponse.json({ error: 'Validation', issues: parsedBody.error.issues }, { status: 400, headers: jsonHeaders })
    }
    const body = parsedBody.data
    const result = await prisma.$transaction(async (tx) => {
      const identity = await tx.lookupImportProposal.findUnique({
        where: { id: body.proposalId }, select: { id: true, tableId: true },
      })
      if (!identity || identity.tableId !== id) return { status: 'not_found' as const }
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "LookupTable" WHERE "id" = ${id} FOR UPDATE`)
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "LookupImportProposal" WHERE "id" = ${body.proposalId} FOR UPDATE`)
      const proposal = await tx.lookupImportProposal.findUnique({
        where: { id: body.proposalId },
        include: {
          table: { select: { requiresApproval: true } },
          approvals: { select: { approverEmail: true }, take: 10 },
        },
      })
      if (!proposal) return { status: 'not_found' as const }
      if (!proposal.table.requiresApproval) return { status: 'not_required' as const }
      if (proposal.state !== 'prepared') return { status: 'not_prepared' as const }
      const approverEmail = auth.user.email.trim().toLowerCase()
      if (proposal.approvals.some((approval) => approval.approverEmail.trim().toLowerCase() === approverEmail)) {
        return { status: 'already_approved' as const, count: proposal.approvals.length }
      }
      await tx.lookupImportApproval.create({
        data: {
          proposalId: proposal.id,
          approverEmail,
          approverName: auth.user.name,
          comment: body.comment ?? null,
        },
      })
      const count = proposal.approvals.length + 1
      return { status: 'recorded' as const, count }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })

    if (result.status === 'not_found') {
      return NextResponse.json({ error: 'Proposition introuvable' }, { status: 404, headers: jsonHeaders })
    }
    if (result.status === 'not_required' || result.status === 'not_prepared') {
      return NextResponse.json({ error: 'Proposition non approbable' }, { status: 409, headers: jsonHeaders })
    }
    if (result.status === 'already_approved') {
      return NextResponse.json({ ...result, required: REQUIRED_APPROVALS }, { status: 409, headers: jsonHeaders })
    }
    return NextResponse.json({
      ...result,
      required: REQUIRED_APPROVALS,
      canPublish: result.count >= REQUIRED_APPROVALS,
    }, { headers: jsonHeaders })
  } catch (err) {
    if (err instanceof SyntaxError) {
      return NextResponse.json({ error: 'JSON invalide' }, { status: 400, headers: jsonHeaders })
    }
    console.error('[lookup approve] error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500, headers: jsonHeaders }
    )
  }
}
