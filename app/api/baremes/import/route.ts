import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdminAuth } from '@/lib/auth-check'
import { ensureWriteAllowed } from '@/lib/admin/readonly-guard'
import { checkRateLimit, getClientIp } from '@/lib/utils/rate-limit'
import { matchesSignature } from '@/lib/file-signatures'
import { importBaremeFile } from '@/lib/baremes/importBaremeFile'
import { logActivity } from '@/lib/activity-logger'

export const runtime = 'nodejs'

const jsonHeaders = { 'Content-Type': 'application/json; charset=utf-8' }
const MAX_BYTES = 20 * 1024 * 1024 // 20 MB

const formSchema = z.object({
  requiresApproval: z.boolean(),
})

export async function POST(req: NextRequest) {
  // Sécurité : admin uniquement, jamais exposé publiquement.
  const auth = await requireAdminAuth()
  if (!auth.isAuthorized) return auth.error

  // Impersonation en lecture seule / comptes démo : mutation refusée.
  const writeGuard = await ensureWriteAllowed()
  if (writeGuard) return writeGuard

  // Anti-abus : l'import parse un classeur complet (coûteux). 10/h par admin + 20/h par IP.
  const ip = getClientIp(req)
  const byUser = checkRateLimit(`baremes-import:user:${auth.user.id}`, {
    windowMs: 60 * 60_000,
    max: 10,
  })
  const byIp = checkRateLimit(`baremes-import:ip:${ip}`, { windowMs: 60 * 60_000, max: 20 })
  if (!byUser.ok || !byIp.ok) {
    return NextResponse.json(
      { error: 'Trop d\'imports — réessayez dans une heure' },
      { status: 429, headers: jsonHeaders }
    )
  }

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json(
        { error: 'Aucun fichier reçu (champ "file" attendu)' },
        { status: 400, headers: jsonHeaders }
      )
    }

    // Seuls les .xlsx sont acceptés (pas de .xlsm : on refuse les classeurs à macros)
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

    // Signature binaire : un .xlsx est une archive ZIP (PK\x03\x04). Refuse les
    // fichiers renommés (exécutables, HTML…) avant tout parsing.
    if (!matchesSignature(buffer, 'xlsx')) {
      return NextResponse.json(
        { error: 'Le fichier ne ressemble pas à un classeur .xlsx valide (signature binaire incorrecte)' },
        { status: 400, headers: jsonHeaders }
      )
    }

    const parsedForm = formSchema.safeParse({
      requiresApproval: formData.get('requiresApproval') === 'true',
    })
    if (!parsedForm.success) {
      return NextResponse.json(
        { error: 'Paramètres invalides' },
        { status: 400, headers: jsonHeaders }
      )
    }

    // Le parsing lit uniquement les valeurs calculées des cellules : les macros
    // ne sont jamais exécutées, les formules jamais évaluées (lib xlsx en lecture).
    const result = await importBaremeFile({
      buffer,
      fileName: file.name,
      createdBy: auth.user.email,
      requiresApproval: parsedForm.data.requiresApproval,
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
      `Import draft barème: ${result.summary.amountsExtracted} montants, ${result.summary.sheetsParsed}/${result.summary.sheetsDetected} onglets parsés, ${file.size} octets`
    )

    return NextResponse.json(
      {
        status: 'created',
        fileId: result.fileId,
        summary: result.summary,
        alerts: result.alerts,
        validFrom: result.validFrom,
        exportAllowed: result.exportAllowed,
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
