import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma, withDbRetry } from '@/lib/prisma'
import { requireAdminAuth } from '@/lib/auth-check'
import { buildCsv, UTF8_BOM } from '@/lib/baremes/csv'
import {
  CATEGORY_EXPORT_GROUP,
  isBlockingIssue,
  type BaremeAlert,
  type BaremeCategory,
  type BaremeDiagnostics,
} from '@/lib/baremes/types'

export const runtime = 'nodejs'
const jsonHeaders = { 'Content-Type': 'application/json; charset=utf-8' }

const querySchema = z.object({
  type: z.enum([
    'allocations',
    'tranches',
    'montants-base',
    'report',
    'unknown-codes',
    'ignored-rows',
    'unsupported-sheets',
    'raw-preview',
  ]),
})

// Les CSV de données sont bloqués si l'import contient des erreurs bloquantes ;
// les rapports de diagnostic restent toujours téléchargeables (c'est leur rôle).
const DATA_EXPORTS = new Set(['allocations', 'tranches', 'montants-base'])

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminAuth()
  if (!auth.isAuthorized) return auth.error

  try {
    const { id } = await params
    const { searchParams } = new URL(req.url)
    const parsed = querySchema.safeParse({ type: searchParams.get('type') })
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'type invalide (allocations|tranches|montants-base|report|unknown-codes|ignored-rows|unsupported-sheets|raw-preview)' },
        { status: 400, headers: jsonHeaders }
      )
    }
    const { type } = parsed.data

    const file = await withDbRetry(() =>
      prisma.baremeFile.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          status: true,
          fileHash: true,
          fileSize: true,
          validFrom: true,
          effectiveDate: true,
          multiplicateur: true,
          summary: true,
          diagnostics: true,
          alerts: true,
          createdBy: true,
          createdAt: true,
        },
      })
    )
    if (!file) {
      return NextResponse.json({ error: 'Import introuvable' }, { status: 404, headers: jsonHeaders })
    }

    const alerts = (file.alerts ?? []) as unknown as BaremeAlert[]
    const diagnostics = (file.diagnostics ?? null) as unknown as BaremeDiagnostics | null
    const exportAllowed = !alerts.some(isBlockingIssue)
    const baseName = file.name.replace(/\.xlsx$/i, '')
    const periodTag = file.validFrom
      ? new Date(file.validFrom).toISOString().slice(0, 10)
      : 'sans-periode'

    if (DATA_EXPORTS.has(type) && !exportAllowed) {
      return NextResponse.json(
        {
          error:
            'Export bloqué : cet import contient des erreurs bloquantes. Corriger l\'import (ou consulter les rapports de diagnostic) avant d\'exporter les CSV de données.',
          exportAllowed: false,
        },
        { status: 409, headers: jsonHeaders }
      )
    }

    // — CSV de données normalisées —
    if (DATA_EXPORTS.has(type)) {
      const categories = Object.entries(CATEGORY_EXPORT_GROUP)
        .filter(([, g]) => g === type)
        .map(([c]) => c) as BaremeCategory[]

      const rows = await withDbRetry(() =>
        prisma.baremeAmount.findMany({
          where: { fileId: id, category: { in: categories } },
          orderBy: [{ category: 'asc' }, { allocationCode: 'asc' }, { salaryCode: 'asc' }],
        })
      )

      const header = [
        'categorie',
        'feuille_source',
        'code_allocation',
        'code_tranche',
        'article',
        'libelle_fr',
        'libelle_nl',
        'unite',
        'montant',
        'salaire_journalier_min',
        'salaire_journalier_max',
        'valide_a_partir_du',
        'cle_comparaison',
      ]
      const csv = buildCsv(
        header,
        rows.map((a) => [
          a.category,
          a.sourceSheet,
          a.allocationCode,
          a.salaryCode,
          a.article,
          a.labelFr,
          a.labelNl,
          a.unit,
          a.amount.toNumber(),
          a.minDailySalary?.toNumber() ?? null,
          a.maxDailySalary?.toNumber() ?? null,
          a.validFrom ? a.validFrom.toISOString().slice(0, 10) : null,
          a.comparisonKey,
        ])
      )

      const fileNames: Record<string, string> = {
        allocations: `baremes-allocations-${periodTag}.csv`,
        tranches: `tranches-salariales-${periodTag}.csv`,
        'montants-base': `montants-base-${periodTag}.csv`,
      }
      return csvResponse(csv, fileNames[type])
    }

    // — Rapports de diagnostic —
    if (type === 'report') {
      const totalAmounts = await withDbRetry(() =>
        prisma.baremeAmount.count({ where: { fileId: id } })
      )
      const report = {
        generatedAt: new Date().toISOString(),
        file: {
          id: file.id,
          name: file.name,
          status: file.status,
          sha256: file.fileHash,
          sizeBytes: file.fileSize,
          validFrom: file.validFrom,
          effectiveDate: file.effectiveDate,
          multiplicateur: file.multiplicateur,
          createdBy: file.createdBy,
          createdAt: file.createdAt,
        },
        exportAllowed,
        summary: file.summary,
        totalAmounts,
        issues: alerts,
        diagnostics,
      }
      return jsonAttachment(report, `import-report-${baseName}.json`)
    }

    if (type === 'unknown-codes') {
      return jsonAttachment(
        {
          file: file.name,
          generatedAt: new Date().toISOString(),
          unknownCodes: diagnostics?.unknownCodes ?? [],
        },
        `unknown-codes-${baseName}.json`
      )
    }

    if (type === 'ignored-rows') {
      const ignored = diagnostics?.ignoredRows ?? []
      const csv = buildCsv(
        ['feuille', 'ligne_excel', 'raison', 'apercu_cellules'],
        ignored.map((r) => [r.sheet, r.rowIndex, r.reason, r.rawValues.join(' | ')])
      )
      return csvResponse(csv, `ignored-rows-${baseName}.csv`)
    }

    if (type === 'unsupported-sheets') {
      return jsonAttachment(
        {
          file: file.name,
          generatedAt: new Date().toISOString(),
          unsupportedSheets: diagnostics?.unsupportedSheets ?? [],
        },
        `unsupported-sheets-${baseName}.json`
      )
    }

    // raw-preview : grilles brutes des feuilles NON supportées uniquement
    const unsupportedNames = (diagnostics?.unsupportedSheets ?? []).map((s) => s.name)
    const sheets = unsupportedNames.length
      ? await withDbRetry(() =>
          prisma.bareSheet.findMany({
            where: { fileId: id, name: { in: unsupportedNames } },
            orderBy: { sheetIndex: 'asc' },
            select: { name: true, rowCount: true, colCount: true, cellData: true },
          })
        )
      : []
    return jsonAttachment(
      {
        file: file.name,
        generatedAt: new Date().toISOString(),
        sheets: sheets.map((s) => ({
          name: s.name,
          rowCount: s.rowCount,
          colCount: s.colCount,
          cellData: JSON.parse(s.cellData) as string[][],
        })),
      },
      `raw-preview-${baseName}.json`
    )
  } catch (err) {
    console.error('[baremes/import/[id]/export] error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Export failed' },
      { status: 500, headers: jsonHeaders }
    )
  }
}

function csvResponse(csv: string, filename: string): NextResponse {
  return new NextResponse(UTF8_BOM + csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}

function jsonAttachment(payload: unknown, filename: string): NextResponse {
  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
