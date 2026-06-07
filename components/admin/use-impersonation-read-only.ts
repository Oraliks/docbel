"use client"

import { useEffect, useState } from "react"
import { useAuthSession } from "@/components/auth-session-provider"
import { COOKIE_NAMES } from "@/lib/admin/cookies"

/// Lit le cookie de préférence "lecture seule" côté client.
/// Renvoie null si le cookie n'est pas posé → l'appelant applique le default
/// (ON en prod, OFF en dev) — symétrique avec `decideReadOnlyDefault()` côté
/// serveur dans `lib/admin/readonly-guard.ts`.
function readReadOnlyCookie(): boolean | null {
  if (typeof document === "undefined") return null
  const entry = document.cookie
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${COOKIE_NAMES.IMPERSONATION_READONLY}=`))
  if (!entry) return null
  const value = entry.split("=")[1]
  if (value === "1") return true
  if (value === "0") return false
  return null
}

/// Hook qui renvoie `true` ssi :
///   1. la session courante est une impersonation (session.impersonatedBy != null)
///   2. ET le mode lecture seule est actif (cookie posé OU default selon NODE_ENV)
///
/// Usage typique dans un composant admin client :
///   const readOnly = useImpersonationReadOnly()
///   <Button disabled={readOnly} onClick={save}>Enregistrer</Button>
///
/// IMPORTANT — hydration : au 1er render serveur, on renvoie toujours `false`
/// (impossible de lire `document.cookie` côté serveur). Le vrai état est
/// calculé dans un `useEffect`. Le 1er render client peut donc avoir un
/// flash très court "boutons activés" → "boutons grisés" mais ce flash est
/// invisible en pratique (mount immédiat) et évite tout mismatch SSR/CSR.
///
/// Symétrique avec la garde serveur `ensureWriteAllowed()` qui re-vérifie
/// côté API : ce hook est juste de l'UX, pas une garantie sécurité.
export function useImpersonationReadOnly(): boolean {
  const { data: session } = useAuthSession()
  const impersonatedBy = (
    session?.session as { impersonatedBy?: string | null } | undefined
  )?.impersonatedBy
  const isImpersonating = Boolean(session && impersonatedBy)

  // false au 1er render (SSR-safe), recalculé au mount client.
  const [readOnly, setReadOnly] = useState(false)

  useEffect(() => {
    if (!isImpersonating) {
      setReadOnly(false)
      return
    }
    const cookie = readReadOnlyCookie()
    setReadOnly(cookie ?? process.env.NODE_ENV === "production")
  }, [isImpersonating])

  return readOnly
}

/// Libellé partagé pour les tooltips quand un bouton est désactivé par le
/// mode lecture seule. Réutilisé par plusieurs composants pour rester
/// cohérent — modifier ici se propage partout.
export const IMPERSONATION_READ_ONLY_REASON =
  "Désactivé : mode lecture seule actif pendant l'impersonation. Bascule via le cadenas dans la bannière."
