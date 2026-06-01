import { NextRequest, NextResponse } from 'next/server'
import { prisma, withDbRetry } from '@/lib/prisma'
import { buildEntryWhere, extractEntryFilters } from '@/lib/lookup/entryFilters'

export const runtime = 'nodejs'

/**
 * Export CSV des entrées d'une LookupTable, avec les MÊMES filtres que la vue
 * table (`GET /api/lookup/tables/[id]`) — le fichier reflète exactement ce que
 * le partenaire voit à l'écran.
 *
 * Lecture publique (cohérent avec /resolve, /search, /tables) : ce sont des
 * référentiels officiels ONEM, pas des données sensibles. Les `notes` admin
 * NE sont PAS exportées.
 *
 * Format : CSV séparé par `;` (Excel BE) + BOM UTF-8 pour les accents.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(req.url)

    const table = await withDbRetry(() =>
      prisma.lookupTable.findUnique({
        where: { id },
        select: { slug: true, prefix: true, labelFr: true },
      })
    )
    if (!table) {
      return NextResponse.json({ error: 'Table introuvable' }, { status: 404 })
    }

    const where = buildEntryWhere(id, extractEntryFilters(searchParams))

    const entries = await withDbRetry(() =>
      prisma.lookupEntry.findMany({
        where,
        orderBy: [{ code: 'asc' }, { validFrom: 'desc' }],
        select: {
          code: true,
          labelFr: true,
          labelNl: true,
          labelDe: true,
          labelEn: true,
          validFrom: true,
          validUntil: true,
        },
        take: 50_000, // garde-fou : aucune table ONEM réelle n'atteint ce volume après filtre
      })
    )

    const headers = [
      'Code',
      'Description française',
      'Description néerlandaise',
      'Description allemande',
      'Description anglaise',
      'Date de début',
      'Date de fin',
    ]
    const lines = [headers.map(csvCell).join(';')]
    for (const e of entries) {
      lines.push(
        [
          e.code,
          e.labelFr,
          e.labelNl,
          e.labelDe ?? '',
          e.labelEn ?? '',
          fmtDate(e.validFrom),
          fmtDate(e.validUntil),
        ]
          .map(csvCell)
          .join(';')
      )
    }
    // BOM UTF-8 pour qu'Excel lise correctement les accents.
    const csv = '﻿' + lines.join('\r\n')

    const today = fmtDate(new Date()).replace(/\//g, '-')
    const fileName = `lookup-${table.slug}-${today}.csv`

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Cache-Control': 'no-store',
        'X-Export-Rows': String(entries.length),
      },
    })
  } catch (err) {
    console.error('[lookup/tables/[id]/export] error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    )
  }
}

/** Échappe une cellule CSV : guillemets si elle contient ; " ou saut de ligne. */
function csvCell(value: string): string {
  const s = String(value ?? '')
  if (/[";\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

function fmtDate(d: Date | null): string {
  if (!d) return ''
  // Format ONEM DD/MM/YYYY, en UTC pour rester stable peu importe le serveur.
  const day = String(d.getUTCDate()).padStart(2, '0')
  const month = String(d.getUTCMonth() + 1).padStart(2, '0')
  return `${day}/${month}/${d.getUTCFullYear()}`
}
