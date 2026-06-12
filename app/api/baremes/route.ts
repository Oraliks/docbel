import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminAuth } from '@/lib/auth-check'

// GET /api/baremes => list all files
// GET /api/baremes?fileId=xxx => get all sheets of a file (with grid data)
// Réservé à l'admin : la liste expose tous les statuts (drafts, rejetés…) et
// les grilles brutes complètes. Le front public passe par /api/baremes/lookup.
export async function GET(req: NextRequest) {
  const auth = await requireAdminAuth()
  if (!auth.isAuthorized) return auth.error

  try {
    const { searchParams } = new URL(req.url)
    const fileId = searchParams.get('fileId')
    const search = searchParams.get('search')?.toLowerCase().trim() || ''

    // Liste tous les fichiers (tous statuts), triés par pertinence
    if (!fileId) {
      const statusParam = searchParams.get('status')
      const where = statusParam
        ? { status: { in: statusParam.split(',').map((s) => s.trim()) } }
        : {} // pas de filtre = tous statuts

      const files = await prisma.baremeFile.findMany({
        where,
        select: {
          id: true,
          name: true,
          effectiveDate: true,
          validFrom: true,
          uploadedAt: true,
          publishedAt: true,
          multiplicateur: true,
          status: true,
          fileHash: true,
          _count: { select: { sheets: true, amounts: true } },
        },
        orderBy: [{ uploadedAt: 'desc' }],
      })

      return NextResponse.json(
        {
          files: files.map((f) => ({
            id: f.id,
            name: f.name,
            effectiveDate: f.effectiveDate,
            validFrom: f.validFrom,
            uploadedAt: f.uploadedAt,
            publishedAt: f.publishedAt,
            multiplicateur: f.multiplicateur,
            status: f.status,
            isLegacy: !f.fileHash, // legacy = ancien upload sans hash, donc sans BaremeAmount
            sheetsCount: f._count.sheets,
            amountsCount: f._count.amounts,
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
