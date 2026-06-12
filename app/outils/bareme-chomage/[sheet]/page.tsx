import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getActiveBaremeData } from '@/lib/baremes/getActiveBaremeData'
import {
  BAREME_SHEETS,
  ROOT_SHEET_SLUG,
  buildMatrixForEntry,
  findSheet,
} from '@/lib/baremes/sheetRegistry'
import { BaremeMatrix } from '@/components/outils/bareme-matrix'
import { BaremeSheetNav } from '@/components/outils/bareme-sheet-nav'
import { FileSpreadsheet } from 'lucide-react'

export const revalidate = 300

// Pré-génère les sous-routes connues (hors racine chomage-complet).
export function generateStaticParams() {
  return BAREME_SHEETS.filter((s) => s.slug !== ROOT_SHEET_SLUG).map((s) => ({ sheet: s.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ sheet: string }>
}): Promise<Metadata> {
  const { sheet } = await params
  const entry = findSheet(sheet)
  if (!entry) return { title: 'Barème introuvable | DocBel' }
  return {
    title: `${entry.navLabel} — Barèmes chômage ONEM | DocBel`,
    description: `Montants officiels ONEM — ${entry.navLabel}. Barème en vigueur par code et tranche.`,
  }
}

export default async function BaremeSheetPage({
  params,
}: {
  params: Promise<{ sheet: string }>
}) {
  const { sheet } = await params
  const entry = findSheet(sheet)
  // La racine (chomage-complet) vit sur /outils/bareme-chomage, pas ici.
  if (!entry || entry.slug === ROOT_SHEET_SLUG) notFound()

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
          <h1 className="text-xl font-semibold">Barème indisponible</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Aucune donnée publiée pour « {entry.navLabel} » pour le moment.
          </p>
          <Link
            href="/outils/bareme-chomage"
            className="mt-6 inline-block rounded-md border border-border px-4 py-2 text-sm hover:bg-muted"
          >
            Voir le chômage complet
          </Link>
        </div>
      )}
    </div>
  )
}
