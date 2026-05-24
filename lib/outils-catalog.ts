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
import { fetchAllToolsActive } from '@/lib/tools-active'
import { TOOLS_DATA, type Tool, toolSlug } from '@/lib/docbel-data'
import {
  type AudienceId,
  canViewAudience,
  deriveAudiences,
  isAudienceId,
} from '@/lib/audience'

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
  // Batch calculateurs citoyens 2026-05 (cf. lib/calculators/*).
  calc_brut_net: 'Calculs',
  calc_pecule: 'Calculs',
  calc_chomage: 'Calculs',
  calc_indemnite: 'Calculs',
  calc_pension: 'Calculs',
  calc_allocs_fam: 'Calculs',
  calc_ipp: 'Calculs',
  calc_tarif_social: 'Calculs',
  calc_km: 'Calculs',
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
  audience?: string | null
}): Tool {
  // Hiérarchie : t.audience = "citoyen" → visible par tous, etc.
  // Cf. lib/audience.ts → deriveAudiences().
  const toolAudience: AudienceId = isAudienceId(t.audience)
    ? t.audience
    : 'citoyen'
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
    audiences: deriveAudiences(toolAudience),
  }
}

function hashCode(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i)
  return h
}

export async function getPublicCatalog(): Promise<Tool[]> {
  // 1) Tous les outils DB. Le filtre `active=true` passe par un raw SQL
  // (cf. fetchAllToolsActive) car le client Prisma ne connaît pas encore le
  // champ tant que pnpm db:generate n'a pas tourné après la migration.
  const [allTools, activeRows] = await Promise.all([
    prisma.tool.findMany({
      orderBy: [{ popular: 'desc' }, { order: 'asc' }, { name: 'asc' }],
    }),
    fetchAllToolsActive(),
  ])
  const activeSlugs = new Set(activeRows.filter((r) => r.active).map((r) => r.slug))
  const dbTools = allTools.filter((t) => activeSlugs.has(t.slug))

  // IMPORTANT : pour la déduplication entre DB et statique, on utilise
  // TOUS les slugs DB (actifs OU désactivés) — pas seulement les actifs.
  // Sinon, désactiver un outil en admin le ferait "réapparaître" depuis
  // TOOLS_DATA statique (bug). Un slug en DB désactivé doit rester caché.
  const dbSlugsAll = new Set(allTools.map((t) => t.slug))

  const fromDb = dbTools.map(dbToolToDisplay)

  // 2) Entrées statiques NON couvertes par la DB : soit des liens externes
  // (href absolu, ex: lookup-onem partenaire), soit des outils dont le slug
  // n'existe pas du tout en DB (cas legacy purement statique).
  const fromStatic = TOOLS_DATA.filter((s) => {
    const slug = s.slug ?? toolSlug(s.title)
    // Toujours afficher les entrées avec href absolu (ex: partenaire/...)
    if (s.href) return true
    // Calculateurs purement statiques (logique en code, pas en DB) — on les
    // expose UNIQUEMENT si le slug n'existe pas du tout en DB. Un slug DB
    // désactivé ne réapparaît PAS via le fallback statique.
    if (s.type?.startsWith('calc_') && !dbSlugsAll.has(slug)) return true
    return false
  })

  return [...fromDb, ...fromStatic]
}

/**
 * Filtre les outils visibles pour une audience donnée. Comportement
 * hiérarchique : un partenaire voit tous les outils, un employeur voit
 * citoyen+employeur, un citoyen voit citoyen uniquement.
 *
 * Implémentation : `Tool.audiences` (pluriel) liste toutes les audiences
 * autorisées (calculée par `deriveAudiences`). Donc un simple `.includes`
 * réalise déjà la hiérarchie. La fonction `canViewAudience` reste utile
 * côté API/DB où on lit l'audience minimale en singulier.
 */
export function filterByAudience(tools: Tool[], audience: AudienceId): Tool[] {
  return tools.filter((t) => t.audiences.includes(audience))
}

/**
 * Variante low-level qui prend l'audience minimale d'un outil (singulier)
 * et la compare au viewer. Utile quand on a un Tool DB sans passer par la
 * couche TypeScript `Tool.audiences[]`.
 */
export function canToolBeViewedBy(
  toolAudience: AudienceId,
  viewerAudience: AudienceId,
): boolean {
  return canViewAudience(toolAudience, viewerAudience)
}
