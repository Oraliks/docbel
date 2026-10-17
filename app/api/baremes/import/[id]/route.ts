import { NextRequest, NextResponse } from 'next/server'
import { prisma, withDbRetry } from '@/lib/prisma'
import { requireAdminAuth } from '@/lib/auth-check'
import { getPublicationHistory } from '@/lib/baremes/publicationLog'
import { isBlockingIssue, type BaremeAlert } from '@/lib/baremes/types'
import { canResumeComparison } from '@/lib/baremes/comparisonReview'

export const runtime = 'nodejs'
const jsonHeaders = { 'Content-Type': 'application/json; charset=utf-8' }

const PREVIEW_AMOUNTS_LIMIT = 200

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminAuth()
  if (!auth.isAuthorized) return auth.error

  try {
    const { id } = await params

    const file = await withDbRetry(() =>
      prisma.baremeFile.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          filePath: true,
          status: true,
          fileHash: true,
          fileSize: true,
          effectiveDate: true,
          validFrom: true,
          multiplicateur: true,
          summary: true,
          diagnostics: true,
          alerts: true,
          requiresApproval: true,
          publishedAt: true,
          publishedBy: true,
          createdBy: true,
          createdAt: true,
          updatedAt: true,
        },
      })
    )

    if (!file) {
      return NextResponse.json(
        { error: 'Import introuvable' },
        { status: 404, headers: jsonHeaders }
      )
    }

    // Le détail complet est servi par la route paginée /comparison : ne jamais
    // transférer tout le classeur dans cette fiche pour le filtrer en React.
    const comparison = (file.diagnostics as { comparison?: unknown } | null)?.comparison ?? null

    // Échantillon de montants pour aperçu (les 200 premiers)
    const [amounts, totalAmounts, history, approvals] = await Promise.all([
      withDbRetry(() =>
        prisma.baremeAmount.findMany({
          where: { fileId: id },
          orderBy: [{ category: 'asc' }, { allocationCode: 'asc' }, { salaryCode: 'asc' }],
          take: PREVIEW_AMOUNTS_LIMIT,
        })
      ),
      withDbRetry(() => prisma.baremeAmount.count({ where: { fileId: id } })),
      getPublicationHistory(id),
      withDbRetry(() =>
        prisma.baremeApproval.findMany({
          where: { fileId: id },
          orderBy: { createdAt: 'asc' },
          take: 100,
        })
      ),
    ])

    const alerts = (file.alerts ?? []) as unknown as BaremeAlert[]
    const exportAllowed = !alerts.some(isBlockingIssue)
    const { filePath, ...fileWithoutPath } = file

    return NextResponse.json(
      {
        file: {
          ...fileWithoutPath,
          // Le fichier source n'est jamais servi statiquement : l'admin passe
          // par /api/baremes/import/[id]/source (auth + stockage privé). Les
          // imports historiques sans original doivent rester explicitement
          // identifiables, sans exposer leur référence de stockage.
          sourceAvailable: Boolean(filePath),
        },
        exportAllowed,
        amountsPreview: amounts.map(serializeAmount),
        totalAmounts,
        amountsPreviewLimit: PREVIEW_AMOUNTS_LIMIT,
        comparison,
        comparisonRecoverable: !comparison && canResumeComparison(file) && ['draft', 'pending_approval'].includes(file.status),
        history,
        approvals,
      },
      { headers: jsonHeaders }
    )
  } catch (err) {
    console.error('[baremes/import/[id]] error:', err)
    const message = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json(
      { error: message },
      { status: 500, headers: jsonHeaders }
    )
  }
}

interface AmountRow {
  id: string
  sourceSheet: string
  category: string
  allocationCode: string | null
  salaryCode: string | null
  article: string | null
  labelFr: string | null
  labelNl: string | null
  unit: string | null
  amount: { toNumber(): number }
  minDailySalary: { toNumber(): number } | null
  maxDailySalary: { toNumber(): number } | null
  comparisonKey: string
  rawData: unknown
}

function serializeAmount(a: AmountRow) {
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
    // Traçabilité (preview admin uniquement — jamais dans les CSV publics)
    status: (raw.status as string) ?? 'valid',
    warnings: (raw.warnings as string[]) ?? [],
    trace: raw.trace ?? null,
  }
}
