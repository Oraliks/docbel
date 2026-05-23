/**
 * Helpers raw-SQL pour le champ Tool.active.
 *
 * Le client Prisma 5 généré n'inclut pas `active` tant que `pnpm db:generate`
 * n'a pas tourné après l'ajout du champ (cf. prisma/schema.prisma). Sur
 * Windows, le dev server tient un lock DLL qui bloque la regen.
 *
 * En attendant, on contourne via $queryRaw / $executeRaw pour s'assurer
 * que :
 *   - les lectures côté admin/cards et /outils renvoient bien la valeur
 *     persistée
 *   - les writes du toggle persistent vraiment en DB
 *
 * Quand le client est regénéré, ces helpers restent fonctionnels (ils ne
 * font pas de mal) — on pourra les remplacer par des accès normaux plus tard.
 */

import { prisma, withDbRetry } from '@/lib/prisma'

export interface ToolActiveRow {
  id: string
  slug: string
  active: boolean
}

/**
 * Récupère l'état actif de tous les tools (id + slug + active).
 * Utiliser pour filtrer ailleurs par jointure mentale (Set<slug> par exemple).
 */
export async function fetchAllToolsActive(): Promise<ToolActiveRow[]> {
  return withDbRetry(() =>
    prisma.$queryRaw<ToolActiveRow[]>`
      SELECT id, slug, active FROM "Tool"
    `
  )
}

/**
 * Récupère l'état actif d'un seul tool par slug.
 * Renvoie null si l'outil n'existe pas.
 */
export async function fetchToolActive(slug: string): Promise<boolean | null> {
  const rows = await withDbRetry(() =>
    prisma.$queryRaw<{ active: boolean }[]>`
      SELECT active FROM "Tool" WHERE slug = ${slug} LIMIT 1
    `
  )
  if (rows.length === 0) return null
  return rows[0].active
}

/**
 * Met à jour Tool.active par slug. Retourne true si une ligne a été affectée.
 */
export async function setToolActive(slug: string, active: boolean): Promise<boolean> {
  const affected = await withDbRetry(() =>
    prisma.$executeRaw`UPDATE "Tool" SET active = ${active}, "updatedAt" = NOW() WHERE slug = ${slug}`
  )
  return affected > 0
}
