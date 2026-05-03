import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Export une feuille spécifique en CSV
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const sheetId = searchParams.get('sheetId')
    const fileId = searchParams.get('fileId')

    if (!sheetId && !fileId) {
      return NextResponse.json(
        { error: 'sheetId or fileId required' },
        { status: 400, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
      )
    }

    // Export d'une seule feuille
    if (sheetId) {
      const sheet = await prisma.bareSheet.findUnique({ where: { id: sheetId } })
      if (!sheet) {
        return NextResponse.json({ error: 'Sheet not found' }, { status: 404 })
      }

      const cellData: string[][] = JSON.parse(sheet.cellData)
      const csv = toCsv(cellData)
      const utf8BOM = '﻿'

      return new NextResponse(utf8BOM + csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${sheet.name}.csv"`,
        },
      })
    }

    // Export de toutes les feuilles d'un fichier (concat)
    const file = await prisma.baremeFile.findUnique({
      where: { id: fileId! },
      include: { sheets: { orderBy: { sheetIndex: 'asc' } } },
    })

    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    const allCsv = file.sheets
      .map((s) => {
        const data: string[][] = JSON.parse(s.cellData)
        return `=== ${s.name} ===\n${toCsv(data)}\n`
      })
      .join('\n')

    const utf8BOM = '﻿'
    return new NextResponse(utf8BOM + allCsv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${file.name.replace('.xlsx', '')}.csv"`,
      },
    })
  } catch (error) {
    console.error('Export error:', error)
    return NextResponse.json(
      { error: 'Export failed' },
      { status: 500, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
    )
  }
}

function toCsv(grid: string[][]): string {
  return grid
    .map((row) =>
      row.map((cell) => `"${String(cell || '').replace(/"/g, '""')}"`).join(',')
    )
    .join('\n')
}
