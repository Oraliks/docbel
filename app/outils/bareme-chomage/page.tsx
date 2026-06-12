import type { Metadata } from 'next'
import Link from 'next/link'
import { getActiveBaremeData } from '@/lib/baremes/getActiveBaremeData'
import { buildAnbMatrix } from '@/lib/baremes/allocationMatrix'
import { BaremeMatrix } from '@/components/outils/bareme-matrix'
import { FileSpreadsheet } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Barèmes chômage ONEM — Allocation de chômage complet | DocBel',
  description:
    "Consultez les montants journaliers officiels de l'allocation de chômage complet (ONEM) par code, situation familiale et tranche salariale. Données issues du barème officiel en vigueur.",
}

// Revalidation 5 min (aligné sur le cache getActiveBaremeData).
export const revalidate = 300

export default async function BaremeChomagePage() {
  const data = await getActiveBaremeData()
  const matrix = data
    ? buildAnbMatrix(
        data.amountsByCategory.full_unemployment ?? [],
        'full_unemployment',
        data.multiplicateur
      )
    : null

  if (!matrix) {
    return (
      <div className="px-4 py-6 lg:px-6">
        <div className="mx-auto max-w-2xl rounded-2xl border border-border bg-card p-10 text-center shadow-sm">
          <FileSpreadsheet className="mx-auto mb-4 size-10 text-muted-foreground" />
          <h1 className="text-xl font-semibold">Barème indisponible</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Aucun barème de chômage n&apos;est publié pour le moment. Les montants
            apparaîtront ici dès qu&apos;un barème officiel sera mis en ligne.
          </p>
          <Link
            href="/outils"
            className="mt-6 inline-block rounded-md border border-border px-4 py-2 text-sm hover:bg-muted"
          >
            Retour aux outils
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 py-6 lg:px-6">
      <BaremeMatrix data={matrix} />
    </div>
  )
}
