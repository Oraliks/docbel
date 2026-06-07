/// Inventaire centralisé des cookies posés par la feature impersonation.
/// Évite l'éparpillement des string littéraux et les typos silencieuses
/// (un cookie mal nommé = 0 lecture, bug subtil).
///
/// Toutes les valeurs sont préfixées "docbel_" pour ne pas collisionner avec
/// les cookies Better Auth ("better-auth.*"), Next.js, ou un futur plugin.
///
/// Convention :
///   - HttpOnly côté serveur uniquement (sécurité) sauf marker lisible client
///   - SameSite=Lax (les actions admin se font dans le même onglet)
///   - Secure en prod, pas en dev (HTTPS requis)
///   - path=/ pour que les routes /api et les pages les voient

export const COOKIE_NAMES = {
  /// Cookie HMAC qui sauvegarde le cookie session Better Auth complet avant
  /// le mode "visiteur anonyme" (cf. lib/admin/stash-cookie.ts).
  ADMIN_STASH: "docbel_admin_stash",
  /// Marqueur lisible client (HttpOnly=false) qui dit "tu es en mode
  /// visiteur" pour que la bannière s'affiche sans round-trip.
  VIEW_AS_VISITOR: "docbel_view_as_visitor",
  /// Préférence "lecture seule" (0/1) pour l'impersonation. Lue côté client
  /// (bannière → état initial du cadenas) et côté serveur (readonly-guard).
  IMPERSONATION_READONLY: "docbel_impersonation_readonly",
} as const

export type AdminCookieName = (typeof COOKIE_NAMES)[keyof typeof COOKIE_NAMES]

/// Attributs par défaut pour tous les cookies de cette feature, factorisés
/// pour que la prod (Secure) et le dev (non-Secure) restent cohérents.
/// httpOnly et maxAge varient par cookie, donc à passer côté appelant.
export function defaultCookieAttrs(): {
  secure: boolean
  sameSite: "lax"
  path: "/"
} {
  return {
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  }
}
