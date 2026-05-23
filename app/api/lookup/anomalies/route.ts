import { NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/auth-check'
import { detectLookupAnomalies } from '@/lib/lookup/detectAnomalies'

export const runtime = 'nodejs'

export async function GET() {
  const auth = await requireAdminAuth()
  if (!auth.isAuthorized) return auth.error

  const report = await detectLookupAnomalies()
  return NextResponse.json(report, {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  })
}
