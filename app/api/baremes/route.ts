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
    const search = searchParams.get('search')?.trim() || ''

    // Liste tous les fichiers (tous statuts), triés par pertinence
    if (!fileId) {
      const statusParam = searchParams.get('status')
      const statuses = statusParam?.split(',').map((s) => s.trim()).filter(Boolean)
      const cursor = searchParams.get('cursor')
      const requestedLimit = Number(searchParams.get('limit') ?? 50)
      const limit = Number.isInteger(requestedLimit)
        ? Math.min(Math.max(requestedLimit, 1), 100)
        : 50
      const where = {
        ...(statuses?.length ? { status: { in: statuses } } : {}),
        ...(search ? { name: { contains: search, mode: 'insensitive' as const } } : {}),
      }

      const [rows, total] = await Promise.all([
        prisma.baremeFile.findMany({
          where,
          ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
          take: limit + 1,
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
          orderBy: [{ uploadedAt: 'desc' }, { id: 'desc' }],
        }),
        prisma.baremeFile.count({ where }),
      ])
      const hasMore = rows.length > limit
      const files = hasMore ? rows.slice(0, limit) : rows

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
          total,
          hasMore,
          nextCursor: hasMore ? files.at(-1)?.id ?? null : null,
        },
        { headers: { 'Content-Type': 'application/json; charset=utf-8' } }
      )
    }

    // Récupère le fichier + ses feuilles
    const file = await prisma.baremeFile.findUnique({
      where: { id: fileId },
      include: {
        sheets: {
          ...(search ? { where: { searchText: { contains: search.toLowerCase() } } } : {}),
          orderBy: { sheetIndex: 'asc' },
          take: 101,
        },
      },
    })

    if (!file) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
      )
    }

    const sheetsTruncated = file.sheets.length > 100
    const returnedSheets = sheetsTruncated ? file.sheets.slice(0, 100) : file.sheets

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
        sheets: returnedSheets.map((s) => ({
          id: s.id,
          name: s.name,
          category: s.category,
          rowCount: s.rowCount,
          colCount: s.colCount,
          sheetIndex: s.sheetIndex,
          cellData: JSON.parse(s.cellData),
        })),
        sheetsTruncated,
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
