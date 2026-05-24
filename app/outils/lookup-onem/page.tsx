import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { requirePartnerOrAdminAuth } from '@/lib/auth-check'
import { LookupOnemSearch } from '@/components/partenaire/lookup-onem-search'
import { DisabledToolView } from '@/app/outils/[slug]/disabled-tool-view'

export const metadata: Metadata = {
  title: 'Lookup ONEM | DocBel',
  description:
    "Décodage des codes ONEM : recherche fuzzy dans toutes les nomenclatures officielles (signalétique, articles, dispenses, etc.).",
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * Lookup ONEM — route publique sous `/outils/lookup-onem`.
 *
 * Pourquoi sous /outils plutôt que /partenaire : l'URL ne doit pas
 * trahir le rôle requis pour y accéder. L'auth (partenaire OU admin)
 * est validée à l'intérieur de la page, et un non-autorisé tombe sur
 * notFound() — comme pour n'importe quelle page dynamique protégée.
 *
 * L'audience "partenaire" sur Tool.audience filtre l'affichage dans
 * le catalogue public (un citoyen ne le voit pas dans /outils), mais
 * elle ne remplace PAS l'auth check ici — quelqu'un avec l'URL directe
 * doit toujours s'authentifier.
 */
export default async function LookupOnemRoute({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const auth = await requirePartnerOrAdminAuth()
  if (!auth.isAuthorized) {
    notFound()
  }

  // Désactivation côté admin (Tool.active=false) → message neutre,
  // pas un 404. Cohérent avec les autres outils en DB.
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
