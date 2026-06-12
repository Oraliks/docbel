import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma, withDbRetry } from '@/lib/prisma'
import { requireAdminAuth } from '@/lib/auth-check'
import {
  CATEGORY_EXPORT_GROUP,
  type BaremeCategory,
  type BaremeRowStatus,
} from '@/lib/baremes/types'

export const runtime = 'nodejs'
const jsonHeaders = { 'Content-Type': 'application/json; charset=utf-8' }

const querySchema = z.object({
  group: z.enum(['allocations', 'tranches', 'montants-base']).optional(),
  sheet: z.string().max(200).optional(),
  code: z.string().max(60).optional(),
  status: z.enum(['valid', 'warning', 'ignored', 'error', 'unknown']).optional(),
  q: z.string().max(200).optional(),
  page: z.coerce.number().int().min(1).max(1000).default(1),
  pageSize: z.coerce.number().int().min(10).max(500).default(100),
})

/**
 * Preview paginée et filtrable des montants d'un import.
 * Les filtres status/q s'appliquent en mémoire (status vit dans rawData JSON) —
 * un import ONEM fait quelques milliers de lignes, c'est sans enjeu.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminAuth()
  if (!auth.isAuthorized) return auth.error

  try {
    const { id } = await params
    const { searchParams } = new URL(req.url)
    const parsed = querySchema.safeParse(Object.fromEntries(searchParams.entries()))
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Paramètres invalides', details: parsed.error.flatten() },
        { status: 400, headers: jsonHeaders }
      )
    }
    const { group, sheet, code, status, q, page, pageSize } = parsed.data

    const categories = group
      ? (Object.entries(CATEGORY_EXPORT_GROUP)
          .filter(([, g]) => g === group)
          .map(([c]) => c) as BaremeCategory[])
      : undefined

    const rows = await withDbRetry(() =>
      prisma.baremeAmount.findMany({
        where: {
          fileId: id,
          ...(categories ? { category: { in: categories } } : {}),
          ...(sheet ? { sourceSheet: sheet } : {}),
          ...(code ? { allocationCode: code } : {}),
        },
        orderBy: [{ category: 'asc' }, { allocationCode: 'asc' }, { salaryCode: 'asc' }],
      })
    )

    const search = q?.toLowerCase().trim()
    const filtered = rows
      .map((a) => {
        const raw = (a.rawData ?? {}) as Record<string, unknown>
        return {
          id: a.id,
          sourceSheet: a.sourceSheet,
          category: a.category,
          allocationCode: a.allocationCode,
          salaryCode: a.salaryCode,
          article: a.article,
          labelFr: a.labelFr,
          labelNl: a.labelNl,
          unit: a.unit,
          amount: a.amount.toNumber(),
          minDailySalary: a.minDailySalary ? a.minDailySalary.toNumber() : null,
          maxDailySalary: a.maxDailySalary ? a.maxDailySalary.toNumber() : null,
          comparisonKey: a.comparisonKey,
          status: ((raw.status as string) ?? 'valid') as BaremeRowStatus,
          warnings: (raw.warnings as string[]) ?? [],
          trace: raw.trace ?? null,
        }
      })
      .filter((a) => (status ? a.status === status : true))
      .filter((a) => {
        if (!search) return true
        return [
          a.allocationCode,
          a.salaryCode,
          a.article,
          a.labelFr,
          a.labelNl,
          a.comparisonKey,
          a.sourceSheet,
        ]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(search))
      })

    const total = filtered.length
    const start = (page - 1) * pageSize
    const items = filtered.slice(start, start + pageSize)

    // Facettes pour les filtres UI
    const sheets = [...new Set(rows.map((r) => r.sourceSheet))].sort()
    const codes = [...new Set(rows.map((r) => r.allocationCode).filter(Boolean))].sort() as string[]
    const statusCounts: Record<string, number> = {}
    for (const r of rows) {
      const s = (((r.rawData ?? {}) as Record<string, unknown>).status as string) ?? 'valid'
      statusCounts[s] = (statusCounts[s] ?? 0) + 1
    }

    return NextResponse.json(
      { items, total, page, pageSize, facets: { sheets, codes, statusCounts } },
      { headers: jsonHeaders }
    )
  } catch (err) {
    console.error('[baremes/import/[id]/amounts] error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500, headers: jsonHeaders }
    )
  }
}
