import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { requirePartnerOrAdminAuth } from '@/lib/auth-check'
import { LookupOnemSearch } from '@/components/partenaire/lookup-onem-search'
import { DisabledToolView } from '@/app/outils/[slug]/disabled-tool-view'

export const metadata: Metadata = {
  title: 'Lookup ONEM — Espace Partenaire | DocBel',
  description:
    "Décodage des codes ONEM : recherche fuzzy dans toutes les nomenclatures officielles (signalétique, articles, dispenses, etc.).",
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

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

  // Vérifie si l'admin a désactivé l'outil dans /admin/chomage/outils.
  // Si oui : afficher le message "outil indisponible" plutôt que la page
  // normale (cohérent avec le comportement des autres outils en DB).
  const dbTool = await prisma.tool.findUnique({
    where: { slug: 'lookup-onem' },
    select: { name: true, active: true },
  })
  if (dbTool && dbTool.active === false) {
    return <DisabledToolView toolName={dbTool.name} />
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
