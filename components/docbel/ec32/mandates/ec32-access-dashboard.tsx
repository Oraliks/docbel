'use client'

// =====================================================================
//  eC3.2 — Tableau de bord "Gestion des accès"
// ---------------------------------------------------------------------
//  Vue principale du sous-système mandats : 3 onglets (demandés /
//  accordés / reçus) + bouton "Nouvelle demande". Mockup pédagogique,
//  données fictives anonymes. Aucun appel réseau, aucun service.
// =====================================================================

import { useState } from 'react'
import type { ReactNode } from 'react'
import { CalendarDays, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Ec32Card, Ec32Eyebrow } from '@/components/docbel/ec32/ui'
import type { Ec32MandateAccess } from './types'

// ─────────────────────────── Données par défaut ───────────────────────────

const DEFAULT_GRANTED: Ec32MandateAccess[] = [
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

// ─────────────────────────── Utilitaires ───────────────────────────

/** Initiales à partir d'un nom complet ("Karim Benali" → "KB"). */
function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

/** Date ISO yyyy-mm-dd → dd/MM/yyyy. */
function formatIsoDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  if (!y || !m || !d) return iso
  return `${d}/${m}/${y}`
}

// ─────────────────────────── Onglets ───────────────────────────

type DashboardTab = 'requested' | 'granted' | 'received'

const TABS: Array<{ id: DashboardTab; label: string }> = [
  { id: 'requested', label: 'Accès demandés' },
  { id: 'granted', label: 'Accès accordés' },
  { id: 'received', label: 'Accès reçus' },
]

// ─────────────────────────── Composants internes ───────────────────────────

function StatusBadge({ status }: { status: Ec32MandateAccess['status'] }) {
  if (status === 'active') {
    return (
      <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
        Actif
      </span>
    )
  }
  if (status === 'pending') {
    return (
      <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">
        En attente
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
      Expiré
    </span>
  )
}

function AccessRow({
  access,
  actionLabel,
  onAction,
}: {
  access: Ec32MandateAccess
  /** Libellé du bouton d'action (ex. « Révoquer », « Annuler la demande »). */
  actionLabel?: string
  onAction?: (id: string) => void
}) {
  return (
    <li
      className={cn(
        'flex flex-col gap-3 rounded-2xl border border-primary/10 bg-card p-4 shadow-[0_1px_3px_rgba(26,26,36,0.04)]',
        'sm:flex-row sm:items-center sm:justify-between sm:gap-4',
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <div
          aria-hidden
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary"
        >
          {getInitials(access.personName)}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{access.personName}</p>
          <p className="truncate text-xs text-muted-foreground">{access.scopeLabel}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3 sm:gap-4">
        <StatusBadge status={access.status} />
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <CalendarDays className="size-3.5" aria-hidden />
          {access.status === 'pending' ? 'Demandé' : 'Valable'} jusqu&apos;au{' '}
          {formatIsoDate(access.validUntil)}
        </span>
        {actionLabel && (
          <Button
            variant="outline"
            size="sm"
            className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
            onClick={() => onAction?.(access.id)}
          >
            {actionLabel}
          </Button>
        )}
      </div>
    </li>
  )
}

function EmptyHint({
  title,
  children,
  example,
}: {
  title: string
  children: ReactNode
  example?: string
}) {
  return (
    <Ec32Card className="text-sm">
      <p className="text-muted-foreground">{title}</p>
      {example && (
        <p className="mt-3 rounded-xl bg-muted/50 px-3 py-2 text-xs italic text-muted-foreground">
          {example}
        </p>
      )}
      <p className="mt-3 font-medium text-foreground">{children}</p>
    </Ec32Card>
  )
}

// ─────────────────────────── Composant principal ───────────────────────────

export interface Ec32AccessDashboardProps {
  grantedAccesses?: Ec32MandateAccess[]
  requestedAccesses?: Ec32MandateAccess[]
  receivedAccesses?: Ec32MandateAccess[]
  /** Onglet contrôlé (optionnel). Sinon état interne. */
  tab?: DashboardTab
  onTabChange?: (tab: DashboardTab) => void
  onNewRequest?: () => void
  /** Révoquer un accès accordé. */
  onRevoke?: (id: string) => void
  /** Annuler une demande en attente. */
  onCancelRequest?: (id: string) => void
}

export function Ec32AccessDashboard({
  grantedAccesses = DEFAULT_GRANTED,
  requestedAccesses = [],
  receivedAccesses = [],
  tab,
  onTabChange,
  onNewRequest,
  onRevoke,
  onCancelRequest,
}: Ec32AccessDashboardProps) {
  const [internalTab, setInternalTab] = useState<DashboardTab>('granted')
  const activeTab = tab ?? internalTab
  const setActiveTab = (next: DashboardTab) => {
    setInternalTab(next)
    onTabChange?.(next)
  }

  const counts: Record<DashboardTab, number> = {
    requested: requestedAccesses.length,
    granted: grantedAccesses.length,
    received: receivedAccesses.length,
  }

  return (
    <section className="w-full">
      {/* En-tête */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Ec32Eyebrow className="mb-2">Mandats</Ec32Eyebrow>
          <h2 className="text-2xl font-bold leading-tight tracking-tight text-foreground md:text-3xl">
            Gestion des accès
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Donnez accès à votre Carte de chômage temporaire à une personne de confiance.
          </p>
        </div>
        <Button
          variant="default"
          size="lg"
          onClick={onNewRequest}
          className="bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="size-4" aria-hidden />
          Nouvelle demande
        </Button>
      </div>

      {/* Onglets pilule */}
      <div
        role="tablist"
        aria-label="Catégories d'accès"
        className="mb-6 flex flex-wrap gap-1 rounded-full border border-primary/10 bg-card p-1 shadow-[0_1px_3px_rgba(26,26,36,0.04)]"
      >
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'relative inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {tab.label}
              {counts[tab.id] > 0 && (
                <span
                  className={cn(
                    'inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[0.65rem] font-bold',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground',
                  )}
                >
                  {counts[tab.id]}
                </span>
              )}
              {isActive && (
                <span
                  aria-hidden
                  className="absolute inset-x-4 -bottom-px h-0.5 rounded-full bg-primary"
                />
              )}
            </button>
          )
        })}
      </div>

      {/* Contenu onglets */}
      <div role="tabpanel" aria-label={TABS.find((t) => t.id === activeTab)?.label}>
        {activeTab === 'granted' && (
          <div className="space-y-3">
            {grantedAccesses.length === 0 ? (
              <EmptyHint title="Vous n'avez accordé aucun accès pour le moment.">
                Aucun accès accordé.
              </EmptyHint>
            ) : (
              <ul className="space-y-3">
                {grantedAccesses.map((access) => (
                  <AccessRow
                    key={access.id}
                    access={access}
                    actionLabel="Révoquer"
                    onAction={onRevoke}
                  />
                ))}
              </ul>
            )}
          </div>
        )}

        {activeTab === 'requested' && (
          <div className="space-y-3">
            {requestedAccesses.length === 0 ? (
              <EmptyHint title="Vous retrouverez ici toutes vos demandes d'accès en attente de validation.">
                Aucune demande en attente de validation.
              </EmptyHint>
            ) : (
              <ul className="space-y-3">
                {requestedAccesses.map((access) => (
                  <AccessRow
                    key={access.id}
                    access={access}
                    actionLabel="Annuler la demande"
                    onAction={onCancelRequest}
                  />
                ))}
              </ul>
            )}
          </div>
        )}

        {activeTab === 'received' && (
          <div className="space-y-3">
            {receivedAccesses.length === 0 ? (
              <EmptyHint
                title="Accès accordés par d'autres citoyens."
                example="Par exemple : vous pouvez vous connecter au nom de votre père pour compléter sa carte de chômage temporaire."
              >
                Vous n&apos;avez reçu aucun accès.
              </EmptyHint>
            ) : (
              <ul className="space-y-3">
                {receivedAccesses.map((access) => (
                  <AccessRow key={access.id} access={access} />
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
