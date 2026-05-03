import { writeFile, mkdir } from 'fs/promises'
import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import { prisma } from '@/lib/prisma'
import { requireAdminAuth } from '@/lib/auth-check'
import { parseBaremaFile } from '@/lib/baremes-parser'
import { logActivity } from '@/lib/activity-logger'

export async function POST(req: NextRequest) {
  const auth = await requireAdminAuth()
  if (!auth.isAuthorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File

    if (!file || !file.name.endsWith('.xlsx')) {
      return NextResponse.json(
        { error: 'Only .xlsx files allowed' },
        { status: 400, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
      )
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'File too large (max 10MB)' },
        { status: 400, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
      )
    }

    // Sauvegarder le fichier
    const uploadDir = path.join(process.cwd(), 'public/uploads/baremes')
    await mkdir(uploadDir, { recursive: true })

    const filename = `${Date.now()}-${file.name}`
    const filepath = path.join(uploadDir, filename)
    const buffer = await file.arrayBuffer()
    await writeFile(filepath, Buffer.from(buffer))

    // Parser Excel
    const parsed = parseBaremaFile(buffer)

    // Créer BaremeFile
    const baremeFile = await prisma.baremeFile.create({
      data: {
        name: file.name,
        filePath: `/uploads/baremes/${filename}`,
        effectiveDate: parsed.fileMetadata.effectiveDate,
        multiplicateur: parsed.fileMetadata.multiplicateur,
        createdBy: auth.user?.email || 'unknown',
      },
    })

    // Créer une BareSheet par feuille
    let totalCells = 0
    for (const sheet of parsed.sheets) {
      await prisma.bareSheet.create({
        data: {
          fileId: baremeFile.id,
          name: sheet.name,
          category: sheet.category,
          rowCount: sheet.rowCount,
          colCount: sheet.colCount,
          sheetIndex: sheet.sheetIndex,
          cellData: JSON.stringify(sheet.cellData),
          searchText: sheet.searchText.toLowerCase(),
        },
      })
      totalCells += sheet.rowCount * sheet.colCount
    }

    await logActivity(
      auth.user?.email || 'unknown',
      'created',
      'file',
      file.name,
      baremeFile.id,
      `Uploaded ${parsed.sheets.length} sheets, ${totalCells} cells`
    )

    return NextResponse.json(
      {
        success: true,
        fileId: baremeFile.id,
        filename: file.name,
        effectiveDate: parsed.fileMetadata.effectiveDate,
        sheetsCount: parsed.sheets.length,
        sheets: parsed.sheets.map((s) => ({
          name: s.name,
          category: s.category,
          rows: s.rowCount,
          cols: s.colCount,
        })),
      },
      {
        status: 201,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      }
    )
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
    )
  }
}
