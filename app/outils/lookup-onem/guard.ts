import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { requirePartnerOrAdminAuth } from '@/lib/auth-check'

/**
 * Garde d'accès partagée par les 3 pages du Lookup ONEM (landing, vue table,
 * recherche transverse). Co-localisée ici (fichier non-`page`, donc ignoré par
 * le routeur Next).
 *
 *  - Auth partenaire OU admin requise → `notFound()` sinon (ne trahit pas le
 *    rôle requis, cf. commentaire historique de la route).
 *  - Si l'outil `lookup-onem` est désactivé en DB (Tool.active=false), renvoie
 *    `{ disabledToolName }` pour que la page affiche <DisabledToolView/>.
 */
export async function guardLookupAccess(): Promise<{ disabledToolName: string | null }> {
  const auth = await requirePartnerOrAdminAuth()
  if (!auth.isAuthorized) {
    notFound()
  }

  const dbTool = await prisma.tool.findUnique({
    where: { slug: 'lookup-onem' },
    select: { name: true, active: true },
  })
  if (dbTool && dbTool.active === false) {
    return { disabledToolName: dbTool.name }
  }
  return { disabledToolName: null }
}
