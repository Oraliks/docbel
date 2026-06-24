// =====================================================================
//  /onem/ec32/acces — « Gestion des accès » (sous-système mandats eC3.2)
// ---------------------------------------------------------------------
//  Page pédagogique 100 % fictive : reproduit le portail accesstomydata
//  utilisé dans le vrai parcours eC3.2 pour donner accès à un proche.
//  Aucune donnée n'est réellement transmise, aucun mandat n'est créé.
// =====================================================================

import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { AccesClient } from './acces-client'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('public.ec32')
  return {
    title: t('accesPage.metaTitle'),
    description: t('accesPage.metaDescription'),
    alternates: { canonical: '/onem/ec32/acces' },
    robots: { index: false, follow: false },
  }
}

export default function Ec32AccesPage() {
  return (
    <div className="w-full">
      <AccesClient />
    </div>
  )
}
