import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/baremes => list all files
// GET /api/baremes?fileId=xxx => get all sheets of a file (with grid data)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const fileId = searchParams.get('fileId')
    const search = searchParams.get('search')?.toLowerCase().trim() || ''

    // Liste tous les fichiers
    if (!fileId) {
      const files = await prisma.baremeFile.findMany({
        where: { status: 'active' },
        select: {
          id: true,
          name: true,
          effectiveDate: true,
          uploadedAt: true,
          multiplicateur: true,
          _count: { select: { sheets: true } },
        },
        orderBy: { uploadedAt: 'desc' },
      })

      return NextResponse.json(
        {
          files: files.map((f) => ({
            id: f.id,
            name: f.name,
            effectiveDate: f.effectiveDate,
            uploadedAt: f.uploadedAt,
            multiplicateur: f.multiplicateur,
            sheetsCount: f._count.sheets,
          })),
        },
        { headers: { 'Content-Type': 'application/json; charset=utf-8' } }
      )
    }

    // Récupère le fichier + ses feuilles
    const file = await prisma.baremeFile.findUnique({
      where: { id: fileId },
      include: {
        sheets: {
          orderBy: { sheetIndex: 'asc' },
        },
      },
    })

    if (!file) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
      )
    }

    // Filtrer les feuilles si recherche
    let sheets = file.sheets
    if (search) {
      sheets = sheets.filter((s) => s.searchText.includes(search))
    }

    return NextResponse.json(
      {
        file: {
          id: file.id,
          name: file.name,
          effectiveDate: file.effectiveDate,
          uploadedAt: file.uploadedAt,
          multiplicateur: file.multiplicateur,
          filePath: file.filePath,
        },
        sheets: sheets.map((s) => ({
          id: s.id,
          name: s.name,
          category: s.category,
          rowCount: s.rowCount,
          colCount: s.colCount,
          sheetIndex: s.sheetIndex,
          cellData: JSON.parse(s.cellData),
        })),
      },
      { headers: { 'Content-Type': 'application/json; charset=utf-8' } }
    )
  } catch (error) {
    console.error('GET baremes error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch baremes' },
      { status: 500, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
    )
  }
}
