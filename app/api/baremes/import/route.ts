import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/auth-check'
import { importBaremeFile } from '@/lib/baremes/importBaremeFile'
import { logActivity } from '@/lib/activity-logger'

export const runtime = 'nodejs'

const jsonHeaders = { 'Content-Type': 'application/json; charset=utf-8' }
const MAX_BYTES = 20 * 1024 * 1024 // 20 MB

export async function POST(req: NextRequest) {
  const auth = await requireAdminAuth()
  if (!auth.isAuthorized) return auth.error

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json(
        { error: 'Aucun fichier reçu (champ "file" attendu)' },
        { status: 400, headers: jsonHeaders }
      )
    }

    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      return NextResponse.json(
        { error: 'Seuls les fichiers .xlsx sont acceptés' },
        { status: 400, headers: jsonHeaders }
      )
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: `Fichier trop volumineux (max ${MAX_BYTES / 1024 / 1024} MB)` },
        { status: 400, headers: jsonHeaders }
      )
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const requiresApproval = formData.get('requiresApproval') === 'true'

    const result = await importBaremeFile({
      buffer,
      fileName: file.name,
      createdBy: auth.user.email,
      requiresApproval,
    })

    if (result.status === 'duplicate') {
      return NextResponse.json(
        {
          status: 'duplicate',
          fileId: result.fileId,
          message: result.message,
        },
        { status: 409, headers: jsonHeaders }
      )
    }

    await logActivity(
      auth.user.email,
      'created',
      'file',
      file.name,
      result.fileId,
      `Import draft barème: ${result.summary.amountsExtracted} montants, ${result.summary.sheetsParsed}/${result.summary.sheetsDetected} onglets parsés`
    )

    return NextResponse.json(
      {
        status: 'created',
        fileId: result.fileId,
        summary: result.summary,
        alerts: result.alerts,
        validFrom: result.validFrom,
      },
      { status: 201, headers: jsonHeaders }
    )
  } catch (err) {
    console.error('[baremes/import] error:', err)
    const message = err instanceof Error ? err.message : 'Import failed'
    return NextResponse.json(
      { error: message },
      { status: 500, headers: jsonHeaders }
    )
  }
}
