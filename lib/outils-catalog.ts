/**
 * Construit le catalogue d'outils affiché sur /outils (côté serveur).
 *
 * Source de vérité : la table Tool (active=true). On l'enrichit avec les
 * entrées TOOLS_DATA statiques qui ont un `href` absolu (ex : zone partenaire
 * Lookup ONEM hors arborescence /outils). Les entrées TOOLS_DATA sans href
 * sont dédupliquées par slug (la version DB gagne) — elles servent uniquement
 * au rendu /outils/{slug} en LegacyToolView.
 */

import { prisma } from '@/lib/prisma'
import { TOOLS_DATA, type Tool, toolSlug } from '@/lib/docbel-data'
import type { AudienceId } from '@/lib/audience'

/**
 * Mapping type Tool → catégorie affichée (filtre pills sur /outils).
 * Permet d'utiliser les CATEGORIES existantes sans toucher au schéma DB.
 */
const TYPE_TO_CATEGORY: Record<string, string> = {
  form: 'Documents',
  doc_generator: 'Documents',
  calc_preavis: 'Calculs',
  calc_agr: 'Calculs',
  calc_cp: 'Calculs',
  locator: 'Organismes',
  tutorial: 'Tutoriels',
  info: 'Référentiels',
  links: 'Référentiels',
  lookup: 'Référentiels',
}

function dbToolToDisplay(t: {
  id: string
  slug: string
  name: string
  description: string
  type: string
  icon: string | null
  popular: boolean
  timeMin: number | null
  order: number
}): Tool {
  return {
    // Hash léger du cuid pour avoir un number stable côté React keys.
    id: Math.abs(hashCode(t.id)),
    cat: TYPE_TO_CATEGORY[t.type] ?? 'Outils',
    icon: t.icon ?? '🛠️',
    title: t.name,
    desc: t.description,
    popular: t.popular,
    time: t.timeMin ? `${t.timeMin} min` : 'instant',
    type: t.type,
    slug: t.slug,
    // Audiences pas encore stockées en DB — défaut large (lecture publique).
    audiences: ['citoyen', 'employeur', 'partenaire'],
  }
}

function hashCode(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i)
  return h
}

export async function getPublicCatalog(): Promise<Tool[]> {
  // 1) Tous les outils DB actifs. eslint-disable-next-line car Prisma client
  // peut ne pas connaître `active` tant que pnpm db:generate n'a pas tourné
  // après la migration récente.
  const dbTools = await prisma.tool.findMany({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    where: { active: true } as any,
    orderBy: [{ popular: 'desc' }, { order: 'asc' }, { name: 'asc' }],
  })
  const dbSlugs = new Set(dbTools.map((t) => t.slug))

  const fromDb = dbTools.map(dbToolToDisplay)

  // 2) Entrées statiques NON couvertes par la DB : soit des liens externes
  // (href absolu, ex: lookup-onem partenaire), soit des outils dont le slug
  // n'existe plus en DB (cas legacy, ignoré par défaut pour pas réintroduire
  // de fantômes).
  const fromStatic = TOOLS_DATA.filter((s) => {
    const slug = s.slug ?? toolSlug(s.title)
    // Toujours afficher les entrées avec href absolu (ex: partenaire/...)
    if (s.href) return true
    // Sinon, n'afficher que si le slug existe AUSSI en DB → on garde la
    // version DB (filtrée plus haut), donc rien à ajouter ici.
    return false && dbSlugs.has(slug)
  })

  return [...fromDb, ...fromStatic]
}

export function filterByAudience(tools: Tool[], audience: AudienceId): Tool[] {
  return tools.filter((t) => t.audiences.includes(audience))
}
