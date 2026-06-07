import { createHmac, timingSafeEqual } from "node:crypto"
import { cookies } from "next/headers"
import { COOKIE_NAMES, defaultCookieAttrs } from "@/lib/admin/cookies"

/// Cookie stash signé HMAC utilisé pour le mode "visiteur anonyme" (admin
/// déconnecté avec retour 1-clic). Stocke le sessionToken admin pour pouvoir
/// reposer le cookie Better Auth à la restauration.
///
/// La session DB de l'admin reste **valide** pendant le mode visiteur — on
/// efface uniquement le cookie côté navigateur. Restaurer = re-set ce cookie.

const STASH_COOKIE = COOKIE_NAMES.ADMIN_STASH
/// Cookie marqueur (lisible client) qui dit "tu es en mode visiteur, montre
/// la bannière". HttpOnly=false pour que la bannière puisse le lire sans
/// fetch supplémentaire.
const VISITOR_MARKER_COOKIE = COOKIE_NAMES.VIEW_AS_VISITOR

/// Nom du cookie Better Auth (cf. convention BA — default name "better-auth.session_token",
/// préfixé "__Secure-" en HTTPS). On gère les deux pour être robuste.
const BA_SESSION_COOKIE = "better-auth.session_token"
const BA_SESSION_COOKIE_SECURE = `__Secure-${BA_SESSION_COOKIE}`

/// TTL du stash. Aligné sur impersonationSessionDuration (1h) — au-delà, on
/// considère que la session admin doit être réétablie via un vrai login.
const STASH_TTL_SECONDS = 60 * 60

const SECRET = process.env.BETTER_AUTH_SECRET
if (!SECRET) {
  throw new Error("BETTER_AUTH_SECRET requis pour le stash visiteur anonyme")
}

type StashPayload = {
  /// Valeur brute du cookie Better Auth (telle qu'écrite par BA, on la
  /// repose telle quelle à la restauration — pas besoin de comprendre son
  /// format interne).
  cookieValue: string
  /// Nom exact du cookie qu'on a effacé (avec ou sans préfixe __Secure-).
  cookieName: string
  /// adminId pour audit + verif côté restore.
  adminId: string
  /// Expiration en epoch seconds.
  exp: number
}

function sign(payload: StashPayload): string {
  const json = JSON.stringify(payload)
  const b64 = Buffer.from(json).toString("base64url")
  const sig = createHmac("sha256", SECRET!).update(b64).digest("base64url")
  return `${b64}.${sig}`
}

function verify(token: string | undefined): StashPayload | null {
  if (!token) return null
  const dot = token.indexOf(".")
  if (dot <= 0) return null
  const b64 = token.slice(0, dot)
  const sig = token.slice(dot + 1)
  const expected = createHmac("sha256", SECRET!).update(b64).digest("base64url")
  if (sig.length !== expected.length) return null
  try {
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null
  } catch {
    return null
  }
  let payload: StashPayload
  try {
    payload = JSON.parse(Buffer.from(b64, "base64url").toString()) as StashPayload
  } catch {
    return null
  }
  if (payload.exp <= Math.floor(Date.now() / 1000)) return null
  return payload
}

/// Lit le cookie de session Better Auth présent (préfixé ou non) et renvoie
/// le couple (nom, valeur) pour pouvoir le reposer plus tard à l'identique.
export async function readBetterAuthSessionCookie(): Promise<{
  name: string
  value: string
} | null> {
  const c = await cookies()
  const exact = c.get(BA_SESSION_COOKIE_SECURE) ?? c.get(BA_SESSION_COOKIE)
  if (exact) return { name: exact.name, value: exact.value }
  return null
}

/// Pose le cookie stash + cookie marqueur visiteur, et supprime le cookie
/// session Better Auth côté navigateur (la session DB reste intacte).
export async function stashAdminSessionAndGoVisitor(opts: {
  cookieName: string
  cookieValue: string
  adminId: string
}): Promise<void> {
  const c = await cookies()
  const payload: StashPayload = {
    cookieValue: opts.cookieValue,
    cookieName: opts.cookieName,
    adminId: opts.adminId,
    exp: Math.floor(Date.now() / 1000) + STASH_TTL_SECONDS,
  }
  const attrs = defaultCookieAttrs()
  c.set(STASH_COOKIE, sign(payload), {
    httpOnly: true,
    ...attrs,
    maxAge: STASH_TTL_SECONDS,
  })
  // Marqueur lisible client (la bannière le détecte pour s'afficher).
  c.set(VISITOR_MARKER_COOKIE, "1", {
    httpOnly: false,
    ...attrs,
    maxAge: STASH_TTL_SECONDS,
  })
  // Supprime les deux variantes du cookie session BA (préfixée ou pas) —
  // on ne sait jamais lequel le navigateur a posé.
  c.delete(BA_SESSION_COOKIE)
  c.delete(BA_SESSION_COOKIE_SECURE)
}

/// Lit le stash signé, valide HMAC + expiration, renvoie le payload ou null.
export async function readAdminStash(): Promise<StashPayload | null> {
  const c = await cookies()
  return verify(c.get(STASH_COOKIE)?.value)
}

/// Restaure le cookie session admin et nettoie le stash + marqueur visiteur.
export async function restoreAdminSession(payload: StashPayload): Promise<void> {
  const c = await cookies()
  // Best-effort : on repose le cookie au nom exact qu'il avait avant.
  c.set(payload.cookieName, payload.cookieValue, {
    httpOnly: true,
    ...defaultCookieAttrs(),
    // On ne connaît pas exactement le maxAge restant côté BA, on laisse 30j
    // (TTL session BA par défaut) — la DB tranchera si la session est trop
    // vieille (auth.api.getSession refusera).
    maxAge: 60 * 60 * 24 * 30,
  })
  c.delete(STASH_COOKIE)
  c.delete(VISITOR_MARKER_COOKIE)
}

/// True si le marqueur visiteur est posé. Lecture serveur (la bannière fait
/// son propre check côté client via document.cookie).
export async function isVisitorMarkerSet(): Promise<boolean> {
  const c = await cookies()
  return Boolean(c.get(VISITOR_MARKER_COOKIE)?.value)
}

export const VISITOR_MARKER_COOKIE_NAME = VISITOR_MARKER_COOKIE
