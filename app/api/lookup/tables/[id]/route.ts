import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma, withDbRetry } from '@/lib/prisma'
import { requireAdminAuth } from '@/lib/auth-check'
import { invalidateLookupCache } from '@/lib/lookup/getLookupEntry'
import { buildEntryWhere, extractEntryFilters } from '@/lib/lookup/entryFilters'

export const runtime = 'nodejs'
const jsonHeaders = { 'Content-Type': 'application/json; charset=utf-8' }
const DEFAULT_LIMIT = 100
const MAX_LIMIT = 1000

/**
 * Détail d'une table de lookup avec ses entrées paginées.
 *
 * Query params :
 *   - q             : recherche full-text dans code + labelFr + labelNl
 *   - code          : filtre ciblé sur le code (préfixe, insensible à la casse)
 *   - desc          : filtre ciblé sur la description (FR/NL/DE/EN, substring)
 *   - validOn       : ISO date — filtre les entrées valides à cette date
 *   - endDate       : "none" (validUntil null) | "filled" (validUntil non null)
 *   - modifiedSince : ISO date — entrées dont updatedAt >= cette date (édition Beldoc)
 *   - limit         : max d'entrées renvoyées (défaut 100, max 1000)
 *   - offset        : pour pagination
 *   - includeAll    : "true" pour inclure les entrées expirées (défaut: false)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(req.url)
    const limit = Math.min(
      MAX_LIMIT,
      parseInt(searchParams.get('limit') ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT
    )
    const offset = Math.max(0, parseInt(searchParams.get('offset') ?? '0', 10) || 0)

    const table = await withDbRetry(() =>
      prisma.lookupTable.findUnique({
        where: { id },
        include: {
          category: { select: { slug: true, labelFr: true, labelNl: true } },
          approvals: {
            select: { id: true, approverEmail: true, approverName: true, comment: true, createdAt: true },
            orderBy: { createdAt: 'asc' },
          },
        },
      })
    )
    if (!table) {
      return NextResponse.json(
        { error: 'Table introuvable' },
        { status: 404, headers: jsonHeaders }
      )
    }

    // Filtres (code, desc, validOn, endDate, modifiedSince, includeAll) construits
    // par le helper partagé — même logique que l'export CSV.
    const where = buildEntryWhere(id, extractEntryFilters(searchParams))

    const [entries, total] = await Promise.all([
      withDbRetry(() =>
        prisma.lookupEntry.findMany({
          where,
          orderBy: [{ code: 'asc' }, { validFrom: 'desc' }],
          take: limit,
          skip: offset,
        })
      ),
      withDbRetry(() => prisma.lookupEntry.count({ where })),
    ])

    return NextResponse.json(
      {
        table,
        entries,
        pagination: { total, limit, offset },
      },
      { headers: jsonHeaders }
    )
  } catch (err) {
    console.error('[lookup/tables/[id]] error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500, headers: jsonHeaders }
    )
  }
}

const patchTableSchema = z.object({
  labelFr: z.string().min(1).optional(),
  labelNl: z.string().min(1).optional(),
  notes: z.string().nullable().optional(),
  updatedLabel: z.string().nullable().optional(),
  requiresApproval: z.boolean().optional(),
})

/**
 * Édition partielle d'une LookupTable (libellés FR/NL, notes, requiresApproval).
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
    const parsed = patchTableSchema.parse(body)

    const existing = await withDbRetry(() =>
      prisma.lookupTable.findUnique({ where: { id }, select: { slug: true } })
    )
    if (!existing) {
      return NextResponse.json(
        { error: 'Table introuvable' },
        { status: 404, headers: jsonHeaders }
      )
    }

    const updated = await withDbRetry(() =>
      prisma.lookupTable.update({
        where: { id },
        data: {
          ...(parsed.labelFr !== undefined ? { labelFr: parsed.labelFr } : {}),
          ...(parsed.labelNl !== undefined ? { labelNl: parsed.labelNl } : {}),
          ...(parsed.notes !== undefined ? { notes: parsed.notes } : {}),
          ...(parsed.updatedLabel !== undefined ? { updatedLabel: parsed.updatedLabel } : {}),
          ...(parsed.requiresApproval !== undefined
            ? { requiresApproval: parsed.requiresApproval }
            : {}),
        },
      })
    )

    invalidateLookupCache(existing.slug)

    return NextResponse.json({ table: updated }, { headers: jsonHeaders })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation', issues: err.issues },
        { status: 400, headers: jsonHeaders }
      )
    }
    console.error('[lookup/tables/[id]] PATCH error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500, headers: jsonHeaders }
    )
  }
}
