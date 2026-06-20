'use client'

// =====================================================================
//  /onem/ec32/acces — Client : dashboard + wizard mandats
// ---------------------------------------------------------------------
//  Wrapper minimal : tient l'état d'ouverture du wizard, branche le
//  bouton « + Nouvelle demande » et la révocation (no-op pédagogique).
// =====================================================================

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import {
  Ec32AccessDashboard,
  Ec32MandateWizard,
} from '@/components/docbel/ec32/mandates'
import { Ec32InfoBox } from '@/components/docbel/ec32/ui'

export function AccesClient() {
  const [wizardOpen, setWizardOpen] = useState(false)
  return (
    <div className="space-y-6 pb-8">
      <Link
        href="/onem/ec32"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Retour à la simulation eC3.2
      </Link>

      <Ec32InfoBox tone="info">
        Simulation pédagogique non officielle — aucune donnée n’est transmise,
        aucun mandat réel n’est créé. Source de référence : ONEM / SPF Sécurité
        sociale (2026).
      </Ec32InfoBox>

      <Ec32AccessDashboard
        onNewRequest={() => setWizardOpen(true)}
        onRevoke={() => {
          // No-op pédagogique : on ne supprime rien réellement.
        }}
      />

      <Ec32MandateWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        onSubmitted={() => {
          // Pédagogique : on ferme la modale, sans persistance.
          setWizardOpen(false)
        }}
      />
    </div>
  )
}
