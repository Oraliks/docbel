import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronRight } from 'lucide-react'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { prisma, withDbRetry } from '@/lib/prisma'
import { cleanTableLabel } from '@/lib/lookup/cleanTableLabel'
import { resolveLookupLocale } from '@/lib/lookup/locale'
import {
  LookupTableView,
  type TableViewTable,
} from '@/components/partenaire/lookup/table-view'
import { DisabledToolView } from '@/app/outils/[slug]/disabled-tool-view'
import { guardLookupAccess } from '../guard'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tableSlug: string }>
}): Promise<Metadata> {
  const { tableSlug } = await params
  const table = await prisma.lookupTable
    .findFirst({ where: { slug: tableSlug }, select: { labelFr: true, prefix: true } })
    .catch(() => null)
  const label = table ? cleanTableLabel(table.labelFr, table.prefix) : 'Table'
  return {
    title: `${label} | Lookup ONEM | DocBel`,
    description: `Codes officiels ONEM de la table « ${label} » : recherche, filtres et export.`,
  }
}

/**
 * Vue détaillée d'une table de lookup ONEM (refonte façon lookupweb).
 * Route dynamique sœur de /recherche — Next privilégie le segment statique,
 * donc aucune collision avec /outils/lookup-onem/recherche.
 */
export default async function LookupTablePage({
  params,
  searchParams,
}: {
  params: Promise<{ tableSlug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { disabledToolName } = await guardLookupAccess()
  if (disabledToolName) {
    return <DisabledToolView toolName={disabledToolName} />
  }

  const { tableSlug } = await params
  const sp = await searchParams
  // Deep-link ?code= : on ne garde qu'une valeur scalaire (ignore les répétitions).
  const codeParam = Array.isArray(sp.code) ? sp.code[0] : sp.code
  const initialCode = codeParam?.trim() || undefined
  const locale = resolveLookupLocale()
  const table = await withDbRetry(() =>
    prisma.lookupTable.findFirst({
      where: { slug: tableSlug },
      select: {
        id: true,
        slug: true,
        prefix: true,
        labelFr: true,
        labelNl: true,
        group: true,
        sourcePath: true,
        entriesCount: true,
        updatedLabel: true,
        category: { select: { slug: true, labelFr: true } },
      },
    })
  )
  if (!table) {
    notFound()
  }

  const displayLabel = cleanTableLabel(table.labelFr, table.prefix)

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
            <BreadcrumbLink render={<Link href="/outils/lookup-onem" />}>
              {table.category.labelFr}
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator>
            <ChevronRight />
          </BreadcrumbSeparator>
          <BreadcrumbItem>
            <BreadcrumbPage>{displayLabel}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <LookupTableView
        table={table as TableViewTable}
        locale={locale}
        initialCode={initialCode}
      />
    </div>
  )
}
