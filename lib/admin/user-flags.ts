// Helpers PURS de statut compte — CLIENT-SAFE (aucun import). Extraits de
// lib/admin/user-360.ts (qui importe prisma) pour pouvoir être utilisés par des
// composants client SANS tirer PrismaClient dans le bundle navigateur.
// lib/admin/user-360.ts les ré-exporte pour le confort côté serveur.

/// Vrai si le verrouillage anti-bruteforce est actif à l'instant présent.
export function isLockActive(lockedUntil: string | null): boolean {
  if (!lockedUntil) return false
  return new Date(lockedUntil).getTime() > Date.now()
}

/// Vrai si le bannissement est actif (permanent ou non encore expiré).
export function isBanActive(
  banned: boolean,
  banExpires: string | null,
): boolean {
  if (!banned) return false
  if (!banExpires) return true
  return new Date(banExpires).getTime() > Date.now()
}
