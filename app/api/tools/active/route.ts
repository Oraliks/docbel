import { NextResponse } from 'next/server'
import { fetchAllToolsActive } from '@/lib/tools-active'

/**
 * GET /api/tools/active
 *
 * Renvoie la liste des slugs Tool avec leur état actif/inactif. Permet aux
 * surfaces UI client-side (homepage, command palette) de filtrer les outils
 * statiques TOOLS_DATA pour ne pas afficher comme fonctionnels des outils
 * désactivés côté admin.
 *
 * Cache léger côté Next.js — public endpoint, lecture seulement, charge
 * minime (< 20 lignes typiquement).
 */
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const rows = await fetchAllToolsActive()
    const inactive = rows.filter((r) => !r.active).map((r) => r.slug)
    const active = rows.filter((r) => r.active).map((r) => r.slug)
    return NextResponse.json({ active, inactive })
  } catch (error) {
    console.error('Error fetching tools active state:', error)
    // En cas d'erreur, retourner liste vide = ne filtre rien (fail-open).
    // Mieux vaut afficher des outils fantômes brièvement que casser l'UI.
    return NextResponse.json({ active: [], inactive: [] })
  }
}
