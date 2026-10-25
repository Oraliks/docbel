import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma, withDbRetry } from '@/lib/prisma'
import { requireAdminAuth, requirePartnerOrAdminAuth } from '@/lib/auth-check'
import { invalidateLookupCache } from '@/lib/lookup/getLookupEntry'
import { buildEntryWhere, extractEntryFilters } from '@/lib/lookup/entryFilters'
import { privateLookupError, toLookupEntryProjection, toLookupTableProjection } from '@/lib/lookup/projections'

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
  const auth = await requirePartnerOrAdminAuth()
  if (!auth.isAuthorized) return privateLookupError(auth.error)

  try {
    const { id } = await params
    const { searchParams } = new URL(req.url)
    for (const key of ['validOn', 'modifiedSince']) {
      const value = searchParams.get(key)
      if (value && !isValidDateOnly(value)) {
        return NextResponse.json({ error: `${key} doit être une date valide au format AAAA-MM-JJ` }, {
          status: 400, headers: { ...jsonHeaders, 'Cache-Control': 'private, no-store' },
        })
      }
    }
    const requestedLimit = Number(searchParams.get('limit') ?? DEFAULT_LIMIT)
    const offset = Number(searchParams.get('offset') ?? 0)
    if (!Number.isInteger(requestedLimit) || requestedLimit < 1 || requestedLimit > MAX_LIMIT ||
        !Number.isInteger(offset) || offset < 0 || offset > 1_000_000) {
      return NextResponse.json({ error: 'Pagination invalide' }, {
        status: 400,
        headers: { ...jsonHeaders, 'Cache-Control': 'private, no-store' },
      })
    }
    const limit = requestedLimit

    const table = auth.user.isAdmin
      ? await withDbRetry(() => prisma.lookupTable.findUnique({
          where: { id },
          include: {
            category: { select: { slug: true, labelFr: true, labelNl: true } },
            approvals: {
              select: { id: true, approverEmail: true, approverName: true, comment: true, createdAt: true },
              orderBy: { createdAt: 'asc' },
              take: 100,
            },
            importProposals: {
              orderBy: { createdAt: 'desc' },
              take: 20,
              select: {
                id: true, sourceFileName: true, sourceSha256: true, payloadHash: true,
                baseRevision: true, baseHash: true, parserVersion: true, transformation: true,
                diff: true, validationErrors: true, state: true, errorMessage: true,
                createdBy: true, createdAt: true, publishedAt: true, totalRows: true,
                approvals: {
                  take: 10,
                  orderBy: { createdAt: 'asc' },
                  select: { id: true, approverEmail: true, approverName: true, comment: true, createdAt: true },
                },
              },
            },
          },
        }))
      : await withDbRetry(() => prisma.lookupTable.findUnique({
          where: { id },
          select: {
            id: true, slug: true, prefix: true, labelFr: true, labelNl: true,
            group: true, sourcePath: true, entriesCount: true, updatedLabel: true,
            category: { select: { slug: true, labelFr: true, labelNl: true } },
          },
        }))
    if (!table) {
      return NextResponse.json(
        { error: 'Table introuvable' },
        { status: 404, headers: jsonHeaders }
      )
    }

    // Filtres (code, desc, validOn, endDate, modifiedSince, includeAll) construits
    // par le helper partagé — même logique que l'export CSV.
    const where = buildEntryWhere(id, extractEntryFilters(searchParams))

    const [rawEntries, total] = await Promise.all([
      withDbRetry(() =>
        prisma.lookupEntry.findMany({
          where,
          orderBy: [{ code: 'asc' }, { validFrom: 'desc' }],
          take: limit,
          skip: offset,
          ...(auth.user.isAdmin ? {} : {
            select: {
              id: true, code: true, labelFr: true, labelNl: true, labelDe: true,
              labelEn: true, validFrom: true, validUntil: true,
            },
          }),
        })
      ),
      withDbRetry(() => prisma.lookupEntry.count({ where })),
    ])

    return NextResponse.json(
      {
        table: auth.user.isAdmin ? table : (table ? toLookupTableProjection(table) : null),
        entries: auth.user.isAdmin ? rawEntries : rawEntries.map(toLookupEntryProjection),
        pagination: { total, limit, offset },
      },
      { headers: { ...jsonHeaders, 'Cache-Control': 'private, no-store' } }
    )
  } catch (err) {
    console.error('[lookup/tables/[id]] error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500, headers: jsonHeaders }
    )
  }
}

function isValidDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
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
      prisma.lookupTable.findUnique({ where: { id }, select: { slug: true, requiresApproval: true } })
    )
    if (!existing) {
      return NextResponse.json(
        { error: 'Table introuvable' },
      { status: 404, headers: { ...jsonHeaders, 'Cache-Control': 'private, no-store' } }
      )
    }
    if (existing.requiresApproval) {
      return NextResponse.json({ error: 'Les modifications de cette table doivent passer par une proposition approuvée.' }, {
        status: 409, headers: { ...jsonHeaders, 'Cache-Control': 'private, no-store' },
      })
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
          publishedRevision: { increment: 1 },
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
      { status: 500, headers: { ...jsonHeaders, 'Cache-Control': 'private, no-store' } }
    )
  }
}
