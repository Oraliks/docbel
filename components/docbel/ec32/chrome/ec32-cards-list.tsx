'use client'

// =====================================================================
//  eC3.2 — Page « Mes cartes » (pédagogique)
// ---------------------------------------------------------------------
//  Liste des cartes mensuelles pour un employeur sélectionné, avec
//  onglets actives / archivées. Démo : aucune carte n'est archivée
//  par défaut, mais le composant gère les deux états proprement.
// =====================================================================

import { useMemo, useState } from 'react'
import { ArrowLeft, Building2, CalendarDays, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Ec32Card } from '../ui'
import type { Ec32ChromeEmployer, Ec32ChromeMonthCard } from './types'

// ─────────────────────────── Données fictives ───────────────────────────

const DEFAULT_MONTHS: Ec32ChromeMonthCard[] = [
  { key: '2026-07', label: 'JUILLET 2026' },
  { key: '2026-06', label: 'JUIN 2026' },
  { key: '2026-05', label: 'MAI 2026' },
  { key: '2026-04', label: 'AVRIL 2026' },
  { key: '2026-03', label: 'MARS 2026' },
  { key: '2026-02', label: 'FÉVRIER 2026' },
  { key: '2026-01', label: 'JANVIER 2026' },
  { key: '2025-12', label: 'DÉCEMBRE 2025' },
]

// ─────────────────────────── Utilitaires ───────────────────────────

function formatBelgianDate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!match) return iso
  const [, y, m, d] = match
  return `${d}/${m}/${y}`
}

// ─────────────────────────── Props ───────────────────────────

export interface Ec32CardsListProps {
  employer: Ec32ChromeEmployer
  months?: Ec32ChromeMonthCard[]
  onBack?: () => void
  onOpen?: (monthKey: string) => void
  onArchive?: (monthKey: string) => void
  onUnarchive?: (monthKey: string) => void
}

type Tab = 'active' | 'archived'

// ─────────────────────────── Composant ───────────────────────────

export function Ec32CardsList({
  employer,
  months,
  onBack,
  onOpen,
  onArchive,
  onUnarchive,
}: Ec32CardsListProps) {
  const list = useMemo(() => months ?? DEFAULT_MONTHS, [months])
  const [tab, setTab] = useState<Tab>('active')

  const visible = useMemo(
    () => (tab === 'archived' ? list.filter(m => m.archived) : list.filter(m => !m.archived)),
    [list, tab],
  )

  return (
    <div className="space-y-6">
      {/* En-tête. */}
      <header className="space-y-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="-ml-2 gap-1.5 text-foreground/75 hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Retour
        </Button>

        <Ec32Card className="flex items-center gap-4">
          <span
            aria-hidden
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"
          >
            <Building2 className="size-5" />
          </span>
          <div className="min-w-0 flex-1 space-y-0.5">
            <p className="flex flex-wrap items-baseline gap-x-2">
              <span className="truncate text-lg font-semibold text-foreground">
                {employer.name}
              </span>
              <span className="text-xs font-medium text-muted-foreground">
                {employer.enterpriseNumber}
              </span>
            </p>
            <p className="text-sm text-muted-foreground">
              Période d&apos;emploi : depuis le {formatBelgianDate(employer.employmentSince)}
            </p>
          </div>
        </Ec32Card>
      </header>

      {/* Onglets. */}
      <div
        role="tablist"
        aria-label="Filtrer les cartes"
        className="inline-flex items-center gap-1 rounded-2xl border border-primary/15 bg-card/70 p-1"
      >
        <TabButton active={tab === 'active'} onClick={() => setTab('active')}>
          Mes cartes
        </TabButton>
        <TabButton active={tab === 'archived'} onClick={() => setTab('archived')}>
          Cartes archivées
        </TabButton>
      </div>

      {/* Liste des cartes. */}
      {visible.length === 0 ? (
        <Ec32Card className="flex items-center gap-3 text-sm text-muted-foreground">
          <CalendarDays className="size-5 shrink-0 text-primary/70" aria-hidden />
          {tab === 'archived'
            ? 'Aucune carte archivée pour le moment.'
            : 'Aucune carte active à afficher.'}
        </Ec32Card>
      ) : (
        <ul className="space-y-3">
          {visible.map(month => (
            <Ec32Card key={month.key} as="li" className="p-0">
              <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
                <button
                  type="button"
                  onClick={() => onOpen?.(month.key)}
                  className="group flex min-w-0 flex-1 items-center gap-3 text-left transition-colors focus-visible:outline-none"
                >
                  <span
                    aria-hidden
                    className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"
                  >
                    <CalendarDays className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-bold uppercase tracking-wide text-foreground group-hover:text-primary">
                    {month.label}
                  </span>
                  <ChevronRight
                    className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
                    aria-hidden
                  />
                </button>

                <div className="flex shrink-0 items-center gap-2 sm:ml-2">
                  {tab === 'archived' ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onUnarchive?.(month.key)}
                      className="border-orange-300 text-orange-700 hover:bg-orange-50 hover:text-orange-800 dark:border-orange-500/40 dark:text-orange-200 dark:hover:bg-orange-950/40"
                    >
                      Désarchiver
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onArchive?.(month.key)}
                      className="border-orange-300 text-orange-700 hover:bg-orange-50 hover:text-orange-800 dark:border-orange-500/40 dark:text-orange-200 dark:hover:bg-orange-950/40"
                    >
                      Archiver
                    </Button>
                  )}
                </div>
              </div>
            </Ec32Card>
          ))}
        </ul>
      )}
    </div>
  )
}

// ─────────────────────────── Sous-composants ───────────────────────────

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        'inline-flex items-center justify-center rounded-xl px-3.5 py-1.5 text-sm font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
        active
          ? 'bg-primary text-primary-foreground shadow-sm'
          : 'text-foreground/70 hover:bg-primary/10 hover:text-primary',
      )}
    >
      {children}
    </button>
  )
}
