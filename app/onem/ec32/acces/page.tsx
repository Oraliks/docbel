// =====================================================================
//  /onem/ec32/acces — « Gestion des accès » (sous-système mandats eC3.2)
// ---------------------------------------------------------------------
//  Page pédagogique 100 % fictive : reproduit le portail accesstomydata
//  utilisé dans le vrai parcours eC3.2 pour donner accès à un proche.
//  Aucune donnée n'est réellement transmise, aucun mandat n'est créé.
// =====================================================================

import type { Metadata } from 'next'
import { AccesClient } from './acces-client'

export const metadata: Metadata = {
  title: 'Gestion des accès — eC3.2 (simulation pédagogique)',
  description:
    'Simulation pédagogique de la gestion des accès à la carte de contrôle eC3.2 : donner accès à un proche, suivre les accès accordés et reçus. Aucune donnée réelle.',
  alternates: { canonical: '/onem/ec32/acces' },
  robots: { index: false, follow: false },
}

export default function Ec32AccesPage() {
  return (
    <div className="w-full">
      <AccesClient />
    </div>
  )
}
