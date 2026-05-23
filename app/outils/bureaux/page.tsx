import type { Metadata } from 'next'
import { BureauxFinder } from './bureaux-finder'

export const metadata: Metadata = {
  title: 'Trouver un bureau — DocBel',
  description:
    "Trouve d'un coup le bureau compétent pour ta commune : ONEM, CPAS, organisme de paiement (CAPAC, FGTB, CSC, CGSLB), aide juridique. Données officielles ONEM.",
}

export const dynamic = 'force-dynamic'

export default function BureauxToolPage() {
  return (
    <div className="flex flex-col gap-6 py-6 px-4 lg:px-6 w-full">
      <div>
        <h1 className="text-2xl font-bold">Trouver un bureau</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Indique ton code postal — on te dit immédiatement quel ONEM, CPAS,
          organisme de paiement et aide juridique sont compétents pour toi.
          Données officielles ONEM, mises à jour régulièrement.
        </p>
      </div>
      <BureauxFinder />
    </div>
  )
}
