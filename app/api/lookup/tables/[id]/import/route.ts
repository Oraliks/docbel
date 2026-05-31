import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/auth-check'
import { importLookupCsv } from '@/lib/lookup/importLookupCsv'
import { logActivity } from '@/lib/activity-logger'
import { prisma, withDbRetry } from '@/lib/prisma'
import { REQUIRED_APPROVALS } from '@/lib/lookup/approvals'

export const runtime = 'nodejs'
const jsonHeaders = { 'Content-Type': 'application/json; charset=utf-8' }
const MAX_BYTES = 5 * 1024 * 1024 // 5 MB suffit pour un CSV de plusieurs milliers de lignes

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminAuth()
  if (!auth.isAuthorized) return auth.error

  try {
    const { id } = await params
    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json(
        { error: 'Aucun fichier reçu (champ "file" attendu)' },
        { status: 400, headers: jsonHeaders }
      )
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: `Fichier trop volumineux (max ${MAX_BYTES / 1024 / 1024} MB)` },
        { status: 400, headers: jsonHeaders }
      )
    }

    // Check approbations 4-yeux si table sensible
    const tableInfo = await withDbRetry(() =>
      prisma.lookupTable.findUnique({
        where: { id },
        select: {
          requiresApproval: true,
          approvals: { select: { approverEmail: true } },
        },
      })
    )
    if (tableInfo?.requiresApproval) {
      const distinctApprovers = new Set(tableInfo.approvals.map((a) => a.approverEmail))
      if (distinctApprovers.size < REQUIRED_APPROVALS) {
        return NextResponse.json(
          {
            error: 'Approbation requise',
            details: `Cette table requiert ${REQUIRED_APPROVALS} approbations distinctes (actuellement ${distinctApprovers.size}). Demande à un second admin d'approuver via la page table.`,
            approvalsCount: distinctApprovers.size,
            required: REQUIRED_APPROVALS,
          },
          { status: 403, headers: jsonHeaders }
        )
      }
    }

    const content = await file.text()
    const result = await importLookupCsv({
      tableId: id,
      csvContent: content,
      fileName: file.name,
      importedBy: auth.user.email,
    })

    // Reset des approbations après import réussi (cycle suivant doit re-approuver)
    if (tableInfo?.requiresApproval) {
      await withDbRetry(() => prisma.lookupApproval.deleteMany({ where: { tableId: id } }))
    }

    await logActivity(
      auth.user.email,
      'created',
      'file',
      file.name,
      id,
      `Import lookup ONEM : ${result.inserted} insérées, ${result.updated} mises à jour, ${result.errors.length} erreurs`
    )

    return NextResponse.json(result, { headers: jsonHeaders })
  } catch (err) {
    console.error('[lookup/tables/[id]/import] error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500, headers: jsonHeaders }
    )
  }
}
