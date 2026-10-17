import { NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/auth-check'
import { recordBaremeComparisonReview } from '@/lib/baremes/comparisonReview'

export const runtime = 'nodejs'
const jsonHeaders = { 'Content-Type': 'application/json; charset=utf-8' }

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminAuth()
  if (!auth.isAuthorized) return auth.error
  const { id } = await params
  const result = await recordBaremeComparisonReview(id, auth.user.email)
  if (result.status === 'error') {
    const status = result.reason === 'not_found' ? 404 : result.reason === 'stale' ? 409 : 422
    return NextResponse.json({ error: result.message, reason: result.reason }, { status, headers: jsonHeaders })
  }
  return NextResponse.json({ status: result.status, comparison: result.snapshot }, { headers: jsonHeaders })
}
