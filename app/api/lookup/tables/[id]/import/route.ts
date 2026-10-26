import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/auth-check'
import { createLookupImportProposal, publishLookupImportProposal } from '@/lib/lookup/importWorkflow'
import { logActivity } from '@/lib/activity-logger'

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
    const proposalId = formData.get('proposalId')
    const retryFailed = formData.get('retryFailed') === 'true'
    if (typeof proposalId === 'string' && proposalId.trim()) {
      const result = await publishLookupImportProposal({
        proposalId: proposalId.trim(),
        publishedBy: auth.user.email,
        expectedTableId: id,
        retryFailed,
      })
      if (result.state !== 'published' && result.state !== 'already_published') {
        return NextResponse.json(result, {
          status: result.state === 'pending_approvals' ? 409 : 409,
          headers: { ...jsonHeaders, 'Cache-Control': 'private, no-store' },
        })
      }
      if (result.state === 'published') {
        await logActivity(auth.user.email, 'created', 'file', `lookup-import-${proposalId}`, id,
          `Publication lookup ONEM : ${result.inserted ?? 0} insérées, ${result.updated ?? 0} mises à jour`)
          .catch((error) => console.error('[lookup import] activity log failed after publication:', error))
      }
      return NextResponse.json(result, { headers: { ...jsonHeaders, 'Cache-Control': 'private, no-store' } })
    }

    const file = formData.get('file')

    if (!(file instanceof File)) {
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

    const content = await file.text()
    const proposal = await createLookupImportProposal({
      tableId: id,
      csvContent: content,
      fileName: file.name,
      createdBy: auth.user.email,
    })
    if (proposal.state === 'failed') {
      return NextResponse.json(proposal, {
        status: 422,
        headers: { ...jsonHeaders, 'Cache-Control': 'private, no-store' },
      })
    }
    if (proposal.requiresApproval) {
      return NextResponse.json(proposal, {
        status: 202,
        headers: { ...jsonHeaders, 'Cache-Control': 'private, no-store' },
      })
    }
    const result = await publishLookupImportProposal({ proposalId: proposal.id, publishedBy: auth.user.email, expectedTableId: id })
    if (result.state !== 'published' && result.state !== 'already_published') {
      return NextResponse.json(result, { status: 409, headers: { ...jsonHeaders, 'Cache-Control': 'private, no-store' } })
    }
    await logActivity(auth.user.email, 'created', 'file', file.name, id,
      `Import lookup ONEM : ${result.inserted ?? 0} insérées, ${result.updated ?? 0} mises à jour`)
      .catch((error) => console.error('[lookup import] activity log failed after publication:', error))
    return NextResponse.json({ ...proposal, ...result }, { headers: { ...jsonHeaders, 'Cache-Control': 'private, no-store' } })
  } catch (err) {
    console.error('[lookup/tables/[id]/import] error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500, headers: jsonHeaders }
    )
  }
}
