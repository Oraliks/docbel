import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import { BureauxFinder } from './bureaux-finder'
import { DisabledToolView } from '../[slug]/disabled-tool-view'

export const metadata: Metadata = {
  title: 'Trouver un bureau — DocBel',
  description:
    "Trouve d'un coup le bureau compétent pour ta commune : ONEM, CPAS, organisme de paiement, aide juridique. Données officielles ONEM.",
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * Route dédiée au localisateur "Trouver un bureau".
 *
 * Cette page contourne le routage générique `/outils/[slug]/page.tsx`
 * (qui gère la désactivation via DisabledToolView) — donc on doit
 * répliquer la même vérification ici, sinon désactiver "bureaux" en
 * admin laisse la page accessible.
 */
export default async function BureauxToolPage() {
  const dbTool = await prisma.tool.findUnique({
    where: { slug: 'bureaux' },
    select: { name: true, active: true },
  })

  if (dbTool && dbTool.active === false) {
    return <DisabledToolView toolName={dbTool.name} />
  }

  return (
    <div className="flex flex-col gap-6 py-6 px-4 lg:px-6 w-full">
      <div>
        <h1 className="text-2xl font-bold">Trouver un bureau</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Indique ton code postal — on te dit immédiatement quel ONEM, CPAS,
          organisme de paiement et aide juridique sont compétents pour toi.
          Données officielles ONEM, mises à jour régulièrement.
        </p>
      </div>
      <BureauxFinder />
    </div>
  )
}
