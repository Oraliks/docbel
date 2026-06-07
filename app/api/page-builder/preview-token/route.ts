import { NextRequest, NextResponse } from "next/server"
import { requireAdminAuth } from "@/lib/auth-check"
import { signPreviewToken } from "@/lib/page-builder/preview-token"

const jsonHeaders = { "Content-Type": "application/json; charset=utf-8" }

/**
 * Mint d'un token d'aperçu signé pour une page (brouillon partageable).
 * Réservé aux admins (même garde que le reste de l'éditeur). Param `id` = id de
 * la page. Renvoie `{ token }` ; token vide si aucun secret n'est configuré.
 */
export async function GET(req: NextRequest) {
  const authCheck = await requireAdminAuth()
  if (!authCheck.isAuthorized) return authCheck.error

  const id = req.nextUrl.searchParams.get("id")
  if (!id) {
    return NextResponse.json(
      { error: "Missing 'id' parameter" },
      { status: 400, headers: jsonHeaders }
    )
  }

  return NextResponse.json(
    { token: signPreviewToken(id) },
    { headers: jsonHeaders }
  )
}
