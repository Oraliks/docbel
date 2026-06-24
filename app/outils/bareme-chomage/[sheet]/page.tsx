import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { getActiveBaremeData } from '@/lib/baremes/getActiveBaremeData'
import { BAREME_SHEETS, buildMatrixForEntry, findSheet } from '@/lib/baremes/sheetRegistry'
import { BaremeMatrix } from '@/components/outils/bareme-matrix'
import { BaremeSheetNav } from '@/components/outils/bareme-sheet-nav'
import { FileSpreadsheet } from 'lucide-react'

export const revalidate = 300

// Pré-génère toutes les feuilles connues.
export function generateStaticParams() {
  return BAREME_SHEETS.map((s) => ({ sheet: s.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ sheet: string }>
}): Promise<Metadata> {
  const { sheet } = await params
  const entry = findSheet(sheet)
  const t = await getTranslations('public.outils')
  if (!entry) return { title: t('baremeSheetMetaNotFound') }
  return {
    title: t('baremeSheetMetaTitle', { label: entry.navLabel }),
    description: t('baremeSheetMetaDescription', { label: entry.navLabel }),
  }
}

export default async function BaremeSheetPage({
  params,
}: {
  params: Promise<{ sheet: string }>
}) {
  const { sheet } = await params
  const entry = findSheet(sheet)
  if (!entry) notFound()

  const t = await getTranslations('public.outils')
  const data = await getActiveBaremeData()
  const matrix = data ? buildMatrixForEntry(entry, data) : null

  return (
    <div className="px-4 py-6 lg:px-6">
      <BaremeSheetNav activeSlug={entry.slug} />
      {matrix ? (
        <BaremeMatrix data={matrix} />
      ) : (
        <div className="mx-auto max-w-2xl rounded-2xl border border-border bg-card p-10 text-center shadow-sm">
          <FileSpreadsheet className="mx-auto mb-4 size-10 text-muted-foreground" />
          <h1 className="text-xl font-semibold">{t('baremeSheetEmptyTitle')}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t('baremeSheetEmptyBody', { label: entry.navLabel })}
          </p>
          <Link
            href="/outils/bareme-chomage"
            className="mt-6 inline-block rounded-md border border-border px-4 py-2 text-sm hover:bg-muted"
          >
            {t('baremeSheetSeeAll')}
          </Link>
        </div>
      )}
    </div>
  )
}
