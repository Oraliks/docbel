'use client'

// =====================================================================
//  /onem/ec32/acces — Client : dashboard + wizard mandats
// ---------------------------------------------------------------------
//  Tient l'état des accès (accordés / demandés / reçus) pour que la
//  simulation soit FONCTIONNELLE : créer une demande l'ajoute à
//  « Accès demandés », révoquer/annuler la retire, les compteurs se
//  mettent à jour. 100 % local, aucune persistance, aucun envoi réel.
// =====================================================================

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import {
  Ec32AccessDashboard,
  Ec32MandateWizard,
  type Ec32MandateAccess,
  type Ec32MandateDraft,
} from '@/components/docbel/ec32/mandates'
import { Ec32InfoBox } from '@/components/docbel/ec32/ui'

type DashboardTab = 'requested' | 'granted' | 'received'

const INITIAL_GRANTED: Ec32MandateAccess[] = [
  {
    id: 'k1',
    personName: 'Karim Benali',
    scope: 'temporary_unemployment_card',
    scopeLabel: 'Carte de chômage temporaire',
    status: 'active',
    validUntil: '2027-03-14',
  },
  {
    id: 's1',
    personName: 'Sophie Martin',
    scope: 'temporary_unemployment_card',
    scopeLabel: 'Carte de chômage temporaire',
    status: 'active',
    validUntil: '2027-03-14',
  },
]

/** Construit une date butoir lisible à partir du brouillon (1 an / date). */
function draftValidUntil(draft: Ec32MandateDraft): string {
  if (draft.durationMode === 'until' && draft.durationUntil) {
    return draft.durationUntil
  }
  // « 1 an » : on borne à 1 an après aujourd'hui, sans Date.now() côté serveur
  // (ce composant est client, donc Date est sûr ici).
  const d = new Date()
  d.setFullYear(d.getFullYear() + 1)
  return d.toISOString().slice(0, 10)
}

export function AccesClient() {
  const [wizardOpen, setWizardOpen] = useState(false)
  const [tab, setTab] = useState<DashboardTab>('granted')
  const [granted, setGranted] = useState<Ec32MandateAccess[]>(INITIAL_GRANTED)
  const [requested, setRequested] = useState<Ec32MandateAccess[]>([])
  // Compteur pour générer des identifiants stables sans Math.random/Date.now.
  const [seq, setSeq] = useState(1)

  const handleSubmitted = (draft: Ec32MandateDraft) => {
    const id = `req-${seq}`
    setSeq((n) => n + 1)
    setRequested((prev) => [
      {
        id,
        personName: draft.personName.trim() || 'Demande sans nom',
        scope: 'temporary_unemployment_card',
        scopeLabel: 'Carte de chômage temporaire',
        status: 'pending',
        validUntil: draftValidUntil(draft),
      },
      ...prev,
    ])
    setWizardOpen(false)
    setTab('requested') // on montre la demande fraîchement créée
  }

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
        grantedAccesses={granted}
        requestedAccesses={requested}
        tab={tab}
        onTabChange={setTab}
        onNewRequest={() => setWizardOpen(true)}
        onRevoke={(id) => setGranted((prev) => prev.filter((a) => a.id !== id))}
        onCancelRequest={(id) =>
          setRequested((prev) => prev.filter((a) => a.id !== id))
        }
      />

      <Ec32MandateWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        onSubmitted={handleSubmitted}
      />
    </div>
  )
}
