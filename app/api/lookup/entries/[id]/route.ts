import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma, withDbRetry } from '@/lib/prisma'
import { requireAdminAuth } from '@/lib/auth-check'
import { invalidateLookupCache } from '@/lib/lookup/getLookupEntry'
import { logActivity } from '@/lib/activity-logger'

export const runtime = 'nodejs'
const jsonHeaders = { 'Content-Type': 'application/json; charset=utf-8' }

const patchSchema = z.object({
  labelFr: z.string().optional(),
  labelNl: z.string().optional(),
  labelDe: z.string().nullable().optional(),
  labelEn: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
})

/**
 * Édition partielle d'une LookupEntry (libellés multi-langues + notes).
 * Réservée admin.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminAuth()
  if (!auth.isAuthorized) return auth.error

  try {
    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const parsed = patchSchema.parse(body)

    const existing = await withDbRetry(() =>
      prisma.lookupEntry.findUnique({
        where: { id },
        include: { table: { select: { slug: true } } },
      })
    )
    if (!existing) {
      return NextResponse.json(
        { error: 'Entrée introuvable' },
        { status: 404, headers: jsonHeaders }
      )
    }

    const updated = await withDbRetry(() =>
      prisma.lookupEntry.update({
        where: { id },
        data: {
          ...(parsed.labelFr !== undefined ? { labelFr: parsed.labelFr } : {}),
          ...(parsed.labelNl !== undefined ? { labelNl: parsed.labelNl } : {}),
          ...(parsed.labelDe !== undefined ? { labelDe: parsed.labelDe } : {}),
          ...(parsed.labelEn !== undefined ? { labelEn: parsed.labelEn } : {}),
          ...(parsed.notes !== undefined ? { notes: parsed.notes } : {}),
        },
      })
    )

    invalidateLookupCache(existing.table.slug)

    await logActivity(
      auth.user.email,
      'updated',
      'file',
      `lookup-${existing.code}`,
      id,
      `Édition lookup entry ${existing.table.slug} / ${existing.code}`
    )

    return NextResponse.json({ entry: updated }, { headers: jsonHeaders })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation', issues: err.issues },
        { status: 400, headers: jsonHeaders }
      )
    }
    console.error('[lookup/entries/[id]] PATCH error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500, headers: jsonHeaders }
    )
  }
}
