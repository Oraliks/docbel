'use client'

// =====================================================================
//  eC3.2 — Écran de consentement OAuth (pédagogique)
// ---------------------------------------------------------------------
//  Reproduit, en version Docbel (glass violet/blanc, JAMAIS de logo
//  officiel ONEM/itsme/syndicats), l'écran réel "L'application requiert
//  les accès suivants" + bandeau "valable 23 mois" + boutons Confirmer/
//  Annuler. 100 % pédagogique, aucune donnée réellement transmise.
// =====================================================================

import { Check, Hourglass, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Ec32Card, Ec32Eyebrow, Ec32InfoBox } from '../ui'

// ─────────────────────────── Données ───────────────────────────

interface Scope {
  title: string
  description: string
}

const SCOPES: ReadonlyArray<Scope> = [
  {
    title: 'Accès aux données de login',
    description: "Les données d'identification pour se connecter (openid)",
  },
  {
    title: 'Accès aux données de profil',
    description: 'Accès aux données de profil',
  },
  {
    title: 'Public',
    description: "Consultation des données publiques de l'employeur.",
  },
  {
    title: 'Mandats Citoyen',
    description: 'Mandats citoyen',
  },
  {
    title: 'Consulter ses cartes de chômage temporaire',
    description: 'Consultation des données du citoyen relatives au chômage temporaire',
  },
  {
    title: 'Modifier une carte de chômage temporaire',
    description: "Modification des données d'une carte de contrôle chômage temporaire",
  },
  {
    title: 'Soumettre une carte de chômage temporaire',
    description: 'Soumission d\'une carte de contrôle chômage temporaire',
  },
]

// ─────────────────────────── Pastille décorative ───────────────────────────

/**
 * Pastille « scope accordé » en lecture seule — pédagogique : on indique
 * visuellement que l'accès est demandé. Icône Check violette dans un cercle
 * violet pâle, pas d'interaction.
 */
function ScopeBadge({ className }: { className?: string }) {
  return (
    <span
      role="img"
      aria-label="Accès demandé"
      className={cn(
        'inline-flex size-6 shrink-0 items-center justify-center rounded-full',
        'bg-primary/15 ring-1 ring-primary/30',
        'text-primary',
        className,
      )}
    >
      <Check className="size-3.5" aria-hidden />
    </span>
  )
}

// ─────────────────────────── Composant principal ───────────────────────────

export interface Ec32OAuthConsentProps {
  userName?: string
  onConfirm?: () => void
  onCancel?: () => void
}

export function Ec32OAuthConsent({
  userName = 'Citoyen·ne',
  onConfirm,
  onCancel,
}: Ec32OAuthConsentProps) {
  return (
    <Ec32Card className="mx-auto max-w-2xl space-y-5 p-5 md:p-6">
      {/* En-tête : pastille décorative violette + eyebrow */}
      <header className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <Ec32Eyebrow>
            <ShieldCheck className="size-3.5" aria-hidden />
            Consentement d'accès
          </Ec32Eyebrow>
          <span
            aria-hidden
            className="inline-flex size-10 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/20"
          >
            <ShieldCheck className="size-5 text-primary" />
          </span>
        </div>

        <div className="space-y-1.5">
          <h2 className="text-xl font-bold leading-tight tracking-tight text-foreground md:text-2xl">
            Bonjour {userName},
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            L'application <span className="font-semibold text-foreground">eC3.2 — Carte de contrôle chômage temporaire</span>{' '}
            requiert les accès suivants :
          </p>
        </div>
      </header>

      {/* Liste des 7 scopes */}
      <ul className="space-y-2">
        {SCOPES.map((scope) => (
          <li
            key={scope.title}
            className={cn(
              'flex items-start gap-3 rounded-2xl border border-primary/10 bg-card/60 p-3',
              'shadow-[0_1px_2px_rgba(26,26,36,0.03)]',
            )}
          >
            <ScopeBadge className="mt-0.5" />
            <div className="min-w-0 flex-1 space-y-0.5">
              <p className="text-sm font-semibold leading-snug text-foreground">{scope.title}</p>
              <p className="text-[0.8rem] leading-snug text-muted-foreground">{scope.description}</p>
            </div>
          </li>
        ))}
      </ul>

      {/* Encadré durée de validité */}
      <Ec32InfoBox tone="info" icon={Hourglass}>
        Cet accès est valable pour une durée de <strong>23 mois</strong>. À l'expiration,
        l'autorisation vous sera redemandée (renouvellement).
      </Ec32InfoBox>

      {/* Actions */}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={onCancel}
          className="sm:min-w-32"
        >
          Annuler
        </Button>
        <Button
          type="button"
          variant="default"
          size="lg"
          onClick={onConfirm}
          className="sm:min-w-32"
        >
          Confirmer
        </Button>
      </div>

      {/* Pied de page pédagogique */}
      <p className="border-t border-primary/10 pt-4 text-center text-xs italic text-muted-foreground">
        Simulation pédagogique — aucune donnée n'est réellement transmise.
      </p>
    </Ec32Card>
  )
}

export default Ec32OAuthConsent
