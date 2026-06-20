'use client'

// =====================================================================
//  eC3.2 — Page « Mes employeurs » (pédagogique)
// ---------------------------------------------------------------------
//  Reproduit la liste des employeurs visible à l'ouverture de l'appli.
//  Aucun lien réel : tout est démo, données fictives anonymisées.
// =====================================================================

import { useMemo, useState } from 'react'
import { Building2, ChevronDown, ChevronRight, HelpCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Ec32Card } from '../ui'
import type { Ec32ChromeEmployer } from './types'

// ─────────────────────────── Données fictives ───────────────────────────

const DEFAULT_EMPLOYERS: Ec32ChromeEmployer[] = [
  {
    id: 'demo-docbel-entreprise',
    name: 'Docbel Entreprise',
    enterpriseNumber: '0123.456.789',
    employmentSince: '2024-07-01',
  },
  {
    id: 'demo-docbel-logistics',
    name: 'Docbel Logistics',
    enterpriseNumber: '0987.654.321',
    employmentSince: '2025-02-12',
  },
]

// ─────────────────────────── Utilitaires ───────────────────────────

function formatBelgianDate(iso: string): string {
  // Format dd/MM/yyyy sans dépendre d'Intl pour éviter les variations locales.
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!match) return iso
  const [, y, m, d] = match
  return `${d}/${m}/${y}`
}

// ─────────────────────────── Props ───────────────────────────

export interface Ec32EmployersListProps {
  employers?: Ec32ChromeEmployer[]
  onSelect?: (employerId: string) => void
}

// ─────────────────────────── Composant ───────────────────────────

export function Ec32EmployersList({ employers, onSelect }: Ec32EmployersListProps) {
  const list = useMemo(() => employers ?? DEFAULT_EMPLOYERS, [employers])
  const [helpOpen, setHelpOpen] = useState(false)

  return (
    <div className="space-y-6">
      <header className="space-y-1.5">
        <h2 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
          Mes employeurs
        </h2>
        <p className="text-sm text-muted-foreground">
          Sélectionnez l&apos;employeur concerné pour ouvrir ses cartes de contrôle.
        </p>
      </header>

      {list.length === 0 ? (
        <Ec32Card className="text-center text-sm text-muted-foreground">
          Aucun employeur trouvé.
        </Ec32Card>
      ) : (
        <ul className="space-y-3">
          {list.map(employer => (
            <Ec32Card key={employer.id} interactive as="li" className="p-0">
              <button
                type="button"
                onClick={() => onSelect?.(employer.id)}
                className="group flex w-full items-center gap-4 rounded-3xl px-5 py-4 text-left transition-colors focus-visible:bg-primary/5 focus-visible:outline-none"
              >
                <span
                  aria-hidden
                  className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"
                >
                  <Building2 className="size-5" />
                </span>
                <span className="min-w-0 flex-1 space-y-1">
                  <span className="flex flex-wrap items-baseline gap-x-2">
                    <span className="truncate text-base font-semibold text-foreground">
                      {employer.name}
                    </span>
                    <span className="text-xs font-medium text-muted-foreground">
                      {employer.enterpriseNumber}
                    </span>
                  </span>
                  <span className="block text-sm text-muted-foreground">
                    Période d&apos;emploi : depuis le {formatBelgianDate(employer.employmentSince)}
                  </span>
                </span>
                <ChevronRight
                  className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
                  aria-hidden
                />
              </button>
            </Ec32Card>
          ))}
        </ul>
      )}

      {/* Accordéon d'aide. */}
      <Ec32Card className="p-0">
        <button
          type="button"
          aria-expanded={helpOpen}
          onClick={() => setHelpOpen(v => !v)}
          className="flex w-full items-center gap-3 rounded-3xl px-5 py-4 text-left transition-colors hover:bg-primary/5 focus-visible:bg-primary/5 focus-visible:outline-none"
        >
          <span
            aria-hidden
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"
          >
            <HelpCircle className="size-5" />
          </span>
          <span className="flex-1 text-sm font-semibold text-foreground">
            Quel employeur dois-je choisir ?
          </span>
          <ChevronDown
            className={cn(
              'size-5 shrink-0 text-muted-foreground transition-transform',
              helpOpen && 'rotate-180 text-primary',
            )}
            aria-hidden
          />
        </button>
        {helpOpen && (
          <div className="space-y-3 border-t border-primary/10 px-5 pb-5 pt-4 text-sm leading-relaxed text-foreground/85">
            <p>
              Remplissez la carte de contrôle pour chaque employeur auprès duquel vous avez été mis
              en chômage temporaire. Avez-vous un autre travail (par exemple pour un autre
              employeur ou en tant qu&apos;indépendant) ? Indiquez-le également sur la carte de
              contrôle de l&apos;employeur auprès duquel vous êtes temporairement au chômage.
              Travaillez-vous dans le secteur de la construction (CP 124) ? Remplissez alors
              toujours la carte de contrôle pour votre employeur dans le secteur de la construction
              et mentionnez également, sur cette carte de contrôle, tout autre travail (par exemple
              pour un autre employeur ou en tant qu&apos;indépendant).
            </p>
            <p className="text-xs text-muted-foreground">Source : ONEM</p>
          </div>
        )}
      </Ec32Card>
    </div>
  )
}
