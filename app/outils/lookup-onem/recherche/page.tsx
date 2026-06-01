import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { LookupOnemSearch } from '@/components/partenaire/lookup-onem-search'
import { DisabledToolView } from '@/app/outils/[slug]/disabled-tool-view'
import { guardLookupAccess } from '../guard'

export const metadata: Metadata = {
  title: 'Recherche transverse | Lookup ONEM | DocBel',
  description:
    'Recherche tolérante aux fautes dans toutes les nomenclatures ONEM à la fois (signalétique, articles, dispenses, etc.).',
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * Recherche transverse (fuzzy pg_trgm) — l'ancienne page racine, déplacée ici
 * pour laisser /outils/lookup-onem servir la landing par catégories. Réutilise
 * le composant LookupOnemSearch existant tel quel.
 */
export default async function LookupOnemSearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { disabledToolName } = await guardLookupAccess()
  if (disabledToolName) {
    return <DisabledToolView toolName={disabledToolName} />
  }

  const params = await searchParams
  const initialQ = typeof params.q === 'string' ? params.q : ''
  const initialCategory = typeof params.cat === 'string' ? params.cat : 'all'

  return (
    <div className="flex flex-col gap-5 px-4 py-6 lg:px-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link href="/outils/lookup-onem" />}>
              Lookup ONEM
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator>
            <ChevronRight />
          </BreadcrumbSeparator>
          <BreadcrumbItem>
            <BreadcrumbPage>Recherche transverse</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div>
        <h1 className="text-2xl font-bold">Recherche transverse</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Cherche dans toutes les tables ONEM à la fois. Tape un code (ex:{' '}
          <code className="rounded bg-muted px-1 text-xs">01/43AA1</code>) ou un libellé —
          recherche tolérante aux fautes de frappe.
        </p>
      </div>

      <LookupOnemSearch initialQ={initialQ} initialCategory={initialCategory} />
    </div>
  )
}
