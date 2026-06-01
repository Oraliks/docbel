import type { Metadata } from 'next'
import { prisma, withDbRetry } from '@/lib/prisma'
import { LookupLanding, type LandingCategory } from '@/components/partenaire/lookup/lookup-landing'
import { DisabledToolView } from '@/app/outils/[slug]/disabled-tool-view'
import { guardLookupAccess } from './guard'

export const metadata: Metadata = {
  title: 'Lookup ONEM | DocBel',
  description:
    'Référentiels et signalétiques officiels de l’ONEM : parcourez les tables de codes (signalétique, admissibilité, dispenses, bureaux…) ou lancez une recherche transverse.',
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * Lookup ONEM — landing (refonte façon services.onem.be/lookupweb).
 *
 * Pourquoi sous /outils plutôt que /partenaire : l'URL ne doit pas trahir le
 * rôle requis. L'auth (partenaire OU admin) est validée par guardLookupAccess(),
 * un non-autorisé tombe sur notFound().
 */
export default async function LookupOnemLanding({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { disabledToolName } = await guardLookupAccess()
  if (disabledToolName) {
    return <DisabledToolView toolName={disabledToolName} />
  }

  const params = await searchParams
  const initialCat = typeof params.cat === 'string' ? params.cat : undefined

  const categories = await withDbRetry(() =>
    prisma.lookupCategory.findMany({
      orderBy: { order: 'asc' },
      select: {
        slug: true,
        labelFr: true,
        tables: {
          orderBy: [{ entriesCount: 'desc' }, { labelFr: 'asc' }],
          select: {
            id: true,
            slug: true,
            prefix: true,
            labelFr: true,
            group: true,
            entriesCount: true,
          },
        },
      },
    })
  )

  return (
    <div className="px-4 py-6 lg:px-6">
      <LookupLanding categories={categories as LandingCategory[]} initialCat={initialCat} />
    </div>
  )
}
