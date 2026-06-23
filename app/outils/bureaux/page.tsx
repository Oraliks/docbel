import type { Metadata } from 'next'
import { getLocale, getTranslations } from 'next-intl/server'
import { prisma } from '@/lib/prisma'
import { localizeRecord } from '@/lib/i18n/content'
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
  const dbToolRow = await prisma.tool.findUnique({
    where: { slug: 'bureaux' },
    select: { id: true, name: true, active: true },
  })
  // Traduction du nom (DisabledToolView) en locale courante. id + name requis
  // par le resolver ; no-op en FR, fallback FR sinon.
  const locale = await getLocale()
  const dbTool = dbToolRow
    ? await localizeRecord('Tool', dbToolRow, ['name'], locale)
    : null

  if (dbTool && dbTool.active === false) {
    return <DisabledToolView toolName={dbTool.name} />
  }

  const t = await getTranslations('public.outils')

  return (
    <div className="flex flex-col gap-6 py-6 px-4 lg:px-6 w-full">
      <div>
        <h1 className="text-2xl font-bold">{t('bureauxTitle')}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t('bureauxIntro')}
        </p>
      </div>
      <BureauxFinder />
    </div>
  )
}
