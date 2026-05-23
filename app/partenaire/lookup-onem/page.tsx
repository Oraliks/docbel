import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { requirePartnerOrAdminAuth } from '@/lib/auth-check'
import { LookupOnemSearch } from '@/components/partenaire/lookup-onem-search'

export const metadata: Metadata = {
  title: 'Lookup ONEM — Espace Partenaire | DocBel',
  description:
    "Décodage des codes ONEM : recherche fuzzy dans toutes les nomenclatures officielles (signalétique, articles, dispenses, etc.).",
}

export const dynamic = 'force-dynamic'

export default async function PartnerLookupOnemPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const auth = await requirePartnerOrAdminAuth()
  if (!auth.isAuthorized) {
    // Pour les pages : on rend un 404 plutôt que retourner une réponse JSON.
    notFound()
  }

  const params = await searchParams
  const initialQ = typeof params.q === 'string' ? params.q : ''
  const initialCategory = typeof params.cat === 'string' ? params.cat : 'all'

  return (
    <div className="flex flex-col gap-6 py-6 px-4 lg:px-6">
      <div>
        <h1 className="text-2xl font-bold">Lookup ONEM</h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-3xl">
          Décodage des codes officiels ONEM. Tape un code (ex:{' '}
          <code className="text-xs bg-muted px-1 rounded">01/43AA1</code>) ou un libellé.
          Recherche tolérante aux fautes de frappe.
        </p>
      </div>
      <LookupOnemSearch initialQ={initialQ} initialCategory={initialCategory} />
    </div>
  )
}
