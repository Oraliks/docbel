import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma, withDbRetry } from '@/lib/prisma'
import { requireAdminAuth } from '@/lib/auth-check'
import { ensureWriteAllowed } from '@/lib/admin/readonly-guard'
import { refreshBaremeComparison } from '@/lib/baremes/comparisonReview'
import { compareBaremeVersions } from '@/lib/baremes/compareBaremeVersions'
import type { BaremeComparisonSnapshot, BaremeDiffChange, BaremeDiffChangeType } from '@/lib/baremes/types'

export const runtime = 'nodejs'
const jsonHeaders = { 'Content-Type': 'application/json; charset=utf-8' }
const comparisonTypes = ['modified', 'unchanged', 'added', 'disappeared', 'ambiguous'] as const
const querySchema = z.object({
  state: z.enum(comparisonTypes).optional(),
  sheet: z.string().trim().max(200).optional(),
  category: z.string().trim().max(100).optional(),
  code: z.string().trim().max(60).optional(),
  article: z.string().trim().max(300).optional(),
  label: z.string().trim().max(500).optional(),
  q: z.string().trim().max(500).optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(10).max(200).default(50),
})

/**
 * Vue complète avant/après, servie paginée. Le rapprochement est nécessairement
 * calculé côté serveur (jointure complète de deux imports); le navigateur ne
 * reçoit que la page demandée et les compteurs/facettes utiles au filtre.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminAuth()
  if (!auth.isAuthorized) return auth.error
  try {
    const { id } = await params
    const parsed = querySchema.safeParse(Object.fromEntries(new URL(req.url).searchParams.entries()))
    if (!parsed.success) return NextResponse.json({ error: 'Paramètres de comparaison invalides', details: parsed.error.flatten() }, { status: 400, headers: jsonHeaders })
    const file = await withDbRetry(() => prisma.baremeFile.findUnique({
      where: { id }, select: { id: true, fileType: true, status: true, diagnostics: true },
    }))
    if (!file) return NextResponse.json({ error: 'Import introuvable' }, { status: 404, headers: jsonHeaders })
    const snapshot = readSnapshot(file.diagnostics)
    if (!snapshot) {
      return NextResponse.json({ state: 'legacy_unavailable', error: 'Cet import ne conserve pas de paire de comparaison historique.' }, { status: 409, headers: jsonHeaders })
    }
    const diff = await compareBaremeVersions(id, snapshot.reference?.id ?? null)
    const comparisonAlerts = (file.diagnostics as { comparisonAlerts?: unknown[] } | null)?.comparisonAlerts ?? []
    const currentPublished = await withDbRetry(() => prisma.baremeFile.findFirst({
      where: { status: 'published', fileType: file.fileType, NOT: { id } }, orderBy: [{ validFrom: 'desc' }, { publishedAt: 'desc' }], select: { id: true },
    }))
    // Une archive doit continuer à montrer sa paire historique; seule une
    // candidate encore publiable devient périmée lorsque le publié courant bouge.
    const reviewingDraft = file.status === 'draft' || file.status === 'pending_approval'
    const stale = snapshot.candidate.dataRevision !== diff.candidateDataRevision
      || (snapshot.reference?.dataRevision ?? null) !== diff.referenceDataRevision
      || (reviewingDraft && (snapshot.reference?.id ?? null) !== (currentPublished?.id ?? null))
    const sourceIds = [id, diff.reference?.id].filter((value): value is string => Boolean(value))
    const sourceFiles = await withDbRetry(() => prisma.baremeFile.findMany({
      where: { id: { in: sourceIds } }, take: 2,
      select: { id: true, filePath: true, uploadedAt: true, publishedAt: true, _count: { select: { amounts: true } } },
    }))
    const sources = Object.fromEntries(sourceFiles.map((source) => [source.id, {
      available: Boolean(source.filePath), amountsCount: source._count.amounts,
      uploadedAt: source.uploadedAt.toISOString(), publishedAt: source.publishedAt?.toISOString() ?? null,
    }]))
    const filters = parsed.data
    const filtered = diff.changes.filter((row) => matchesFilters(row, filters))
    const ordered = [...filtered].sort(compareRows)
    const total = ordered.length
    const start = (filters.page - 1) * filters.pageSize
    const items = ordered.slice(start, start + filters.pageSize)
    return NextResponse.json({
      state: stale ? 'stale' : 'ready', comparison: snapshot, comparisonAlerts, sources, current: {
        candidateDataRevision: diff.candidateDataRevision, referenceDataRevision: diff.referenceDataRevision, referenceFileId: currentPublished?.id ?? null,
      }, counts: diff.countsByType, countsByChange: diff.countsByChange,
      filteredTotal: total, total: diff.changes.length, page: filters.page, pageSize: filters.pageSize,
      range: total === 0 ? { start: 0, end: 0 } : { start: start + 1, end: Math.min(start + items.length, total) },
      facets: makeFacets(diff.changes), items,
    }, { headers: jsonHeaders })
  } catch (error) {
    console.error('[baremes/import/[id]/comparison] error:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erreur de comparaison' }, { status: 500, headers: jsonHeaders })
  }
}

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminAuth()
  if (!auth.isAuthorized) return auth.error
  const guard = await ensureWriteAllowed()
  if (guard) return guard
  const { id } = await params
  const result = await refreshBaremeComparison(id, auth.user.email)
  if (result.status === 'error') {
    return NextResponse.json({ error: result.message, reason: result.reason }, { status: result.reason === 'not_found' ? 404 : result.reason === 'unavailable' ? 422 : 409, headers: jsonHeaders })
  }
  return NextResponse.json({ status: result.status, comparison: result.snapshot }, { headers: jsonHeaders })
}

function readSnapshot(diagnostics: unknown): BaremeComparisonSnapshot | null {
  const snapshot = (diagnostics as { comparison?: BaremeComparisonSnapshot } | null)?.comparison
  return snapshot?.version === 1 && snapshot.candidate?.id ? snapshot : null
}
function matchesFilters(row: BaremeDiffChange, filters: z.infer<typeof querySchema>) {
  const source = row.current ?? row.old
  const search = [row.key, source?.allocationCode, source?.salaryCode, source?.article, source?.labelFr, source?.labelNl, source?.sourceSheet, source?.category].filter(Boolean).join(' ').toLocaleLowerCase()
  return (!filters.state || row.type === filters.state)
    && (!filters.sheet || source?.sourceSheet === filters.sheet)
    && (!filters.category || source?.category === filters.category)
    && (!filters.code || [source?.allocationCode, source?.salaryCode].includes(filters.code))
    && (!filters.article || source?.article === filters.article)
    && (!filters.label || [source?.labelFr, source?.labelNl].some((v) => v?.toLocaleLowerCase().includes(filters.label!.toLocaleLowerCase())))
    && (!filters.q || search.includes(filters.q.toLocaleLowerCase()))
}
function compareRows(a: BaremeDiffChange, b: BaremeDiffChange) {
  const order: Record<BaremeDiffChangeType, number> = { modified: 0, added: 1, disappeared: 2, ambiguous: 3, unchanged: 4 }
  return order[a.type] - order[b.type] || (a.sourceSheet ?? '').localeCompare(b.sourceSheet ?? '') || a.key.localeCompare(b.key) || (a.current?.id ?? a.old?.id ?? '').localeCompare(b.current?.id ?? b.old?.id ?? '')
}
function makeFacets(rows: BaremeDiffChange[]) {
  const strings = (value: string | null | undefined) => value ? value : null
  return {
    states: Object.fromEntries(comparisonTypes.map((state) => [state, rows.filter((row) => row.type === state).length])),
    sheets: [...new Set(rows.map((row) => strings((row.current ?? row.old)?.sourceSheet)).filter(Boolean))].sort(),
    categories: [...new Set(rows.map((row) => strings((row.current ?? row.old)?.category)).filter(Boolean))].sort(),
  }
}
