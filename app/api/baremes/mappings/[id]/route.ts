import { NextRequest, NextResponse } from 'next/server'
import { prisma, withDbRetry } from '@/lib/prisma'
import { requireAdminAuth } from '@/lib/auth-check'
import { ensureWriteAllowed } from '@/lib/admin/readonly-guard'

export const runtime = 'nodejs'
const jsonHeaders = { 'Content-Type': 'application/json; charset=utf-8' }

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminAuth()
  if (!auth.isAuthorized) return auth.error

  const writeGuard = await ensureWriteAllowed()
  if (writeGuard) return writeGuard

  try {
    const { id } = await params
    await withDbRetry(() => prisma.baremeSheetMapping.delete({ where: { id } }))
    return NextResponse.json({ ok: true }, { headers: jsonHeaders })
  } catch (err) {
    console.error('[mappings/[id]] DELETE error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500, headers: jsonHeaders }
    )
  }
}
