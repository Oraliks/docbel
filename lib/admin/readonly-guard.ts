import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { withDbRetry } from "@/lib/prisma"
import { isDemoEmail } from "@/lib/admin/demo-users"
import { COOKIE_NAMES } from "@/lib/admin/cookies"

/// Cookie qui pilote le mode lecture seule pour les sessions d'impersonation.
/// Lisible client (la bannière affiche le toggle) + posé par
/// /api/admin/impersonation-readonly.
///   "1" = mutations bloquées
///   "0" = mutations autorisées
/// Si absent : default ON en prod, OFF en dev (decideReadOnlyDefault).
export const READONLY_COOKIE = COOKIE_NAMES.IMPERSONATION_READONLY

export function decideReadOnlyDefault(): boolean {
  return process.env.NODE_ENV === "production"
}

/// Lit la préférence courante (côté serveur). null si pas posée.
export async function readReadOnlyPreference(): Promise<boolean | null> {
  const c = await cookies()
  const v = c.get(READONLY_COOKIE)?.value
  if (v === "1") return true
  if (v === "0") return false
  return null
}

/// Valeur effective : préférence si posée, sinon default selon l'env.
export async function readReadOnlyEffective(): Promise<boolean> {
  const pref = await readReadOnlyPreference()
  return pref ?? decideReadOnlyDefault()
}

/// À appeler dans toute route mutante (POST/PUT/PATCH/DELETE) qui touche aux
/// données de l'utilisateur connecté. Retourne :
///   - null si OK
///   - NextResponse 403 sinon
///
/// Refuse si :
///   1. la session est impersonée ET lecture seule actif (#8 toggle)
///   2. le user actif est un compte demo (#17 — protection DB partagée)
export async function ensureWriteAllowed(): Promise<NextResponse | null> {
  const headerList = await headers()
  const session = await withDbRetry(() =>
    auth.api.getSession({ headers: headerList })
  ).catch(() => null)
  if (!session?.user) return null // pas connecté → route gère elle-même

  // #17 : les comptes demo sont en lecture seule absolue (DB Neon partagée
  // avec d'autres agents Claude → on évite la pollution mutuelle).
  if (isDemoEmail(session.user.email)) {
    return NextResponse.json(
      {
        error:
          "Compte de démo en lecture seule (admin peut basculer via la bannière).",
        code: "demo_read_only",
      },
      { status: 403 }
    )
  }

  // #8 : si impersonation + readonly actif → refuse.
  const impersonatedBy = (session.session as { impersonatedBy?: string | null })
    .impersonatedBy
  if (impersonatedBy) {
    const readOnly = await readReadOnlyEffective()
    if (readOnly) {
      return NextResponse.json(
        {
          error:
            "Mode lecture seule actif pendant l'impersonation. Désactive-le depuis la bannière pour écrire.",
          code: "impersonation_read_only",
        },
        { status: 403 }
      )
    }
  }

  return null
}
