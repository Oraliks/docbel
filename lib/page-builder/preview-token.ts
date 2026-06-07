import { createHmac, timingSafeEqual } from "node:crypto"

/**
 * Token d'aperçu signé pour partager un brouillon de page (non publié) via un
 * lien protégé. HMAC SHA-256 à sens unique sur l'`id` de la page, dérivé du
 * secret serveur (réutilise `BETTER_AUTH_SECRET`, comme le stash visiteur et le
 * HMAC NRN). Le token ne porte aucune donnée : c'est juste une preuve qu'on
 * connaît le secret pour CET id précis (pas d'expiration — la page reste un
 * brouillon tant qu'elle n'est pas publiée).
 *
 * Fail-soft : si aucun secret n'est configuré (build/preview sans env), on
 * renvoie une chaîne vide à la signature et `verifyPreviewToken` renvoie
 * toujours `false`. Aucun lien d'aperçu ne fonctionne, mais rien ne casse.
 */

const SECRET =
  process.env.BETTER_AUTH_SECRET ||
  process.env.AUTH_SECRET ||
  ""

const PREFIX = "page-preview:"

/** Signe un token d'aperçu (hex court) pour l'id de page donné. */
export function signPreviewToken(pageId: string): string {
  if (!SECRET || !pageId) return ""
  return createHmac("sha256", SECRET)
    .update(`${PREFIX}${pageId}`)
    .digest("hex")
    .slice(0, 32)
}

/** Vérifie un token d'aperçu pour l'id de page donné (comparaison constante). */
export function verifyPreviewToken(
  pageId: string,
  token: string | undefined | null
): boolean {
  if (!SECRET || !pageId || !token) return false
  const expected = signPreviewToken(pageId)
  if (!expected || token.length !== expected.length) return false
  try {
    return timingSafeEqual(Buffer.from(token), Buffer.from(expected))
  } catch {
    return false
  }
}
