import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdminAuth } from '@/lib/auth-check'
import { ensureWriteAllowed } from '@/lib/admin/readonly-guard'
import { recordBaremeComparisonReview } from '@/lib/baremes/comparisonReview'

export const runtime = 'nodejs'
const jsonHeaders = { 'Content-Type': 'application/json; charset=utf-8' }
const referenceSchema = z.object({
  id: z.string().min(1).max(200), name: z.string().max(2000), status: z.string().max(50), fileType: z.string().max(100),
  validFrom: z.string().datetime().nullable(), dataRevision: z.string().min(1).max(128),
}).strict()
const reviewSchema = z.object({ comparison: z.object({
  version: z.literal(1), state: z.enum(['computed', 'first_import', 'reference_unavailable']),
  candidate: referenceSchema, reference: referenceSchema.nullable(), computedAt: z.string().datetime(),
}).strict() }).strict()

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminAuth()
  if (!auth.isAuthorized) return auth.error
  const guard = await ensureWriteAllowed()
  if (guard) return guard
  const parsed = reviewSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'La révision de comparaison affichée est requise.' }, { status: 400, headers: jsonHeaders })
  const { id } = await params
  const result = await recordBaremeComparisonReview(id, auth.user.email, parsed.data.comparison)
  if (result.status === 'error') {
    const status = result.reason === 'not_found' ? 404 : result.reason === 'unavailable' ? 422 : 409
    return NextResponse.json({ error: result.message, reason: result.reason }, { status, headers: jsonHeaders })
  }
  return NextResponse.json({ status: result.status, comparison: result.snapshot }, { headers: jsonHeaders })
}
