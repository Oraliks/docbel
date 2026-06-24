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
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Ec32Card, Ec32Eyebrow, Ec32InfoBox } from '../ui'

// ─────────────────────────── Données ───────────────────────────

interface Scope {
  titleKey: string
  descriptionKey: string
}

const SCOPES: ReadonlyArray<Scope> = [
  {
    titleKey: 'oauthConsent.scopes.login.title',
    descriptionKey: 'oauthConsent.scopes.login.description',
  },
  {
    titleKey: 'oauthConsent.scopes.profile.title',
    descriptionKey: 'oauthConsent.scopes.profile.description',
  },
  {
    titleKey: 'oauthConsent.scopes.public.title',
    descriptionKey: 'oauthConsent.scopes.public.description',
  },
  {
    titleKey: 'oauthConsent.scopes.citizenMandates.title',
    descriptionKey: 'oauthConsent.scopes.citizenMandates.description',
  },
  {
    titleKey: 'oauthConsent.scopes.consultCard.title',
    descriptionKey: 'oauthConsent.scopes.consultCard.description',
  },
  {
    titleKey: 'oauthConsent.scopes.modifyCard.title',
    descriptionKey: 'oauthConsent.scopes.modifyCard.description',
  },
  {
    titleKey: 'oauthConsent.scopes.submitCard.title',
    descriptionKey: 'oauthConsent.scopes.submitCard.description',
  },
]

// ─────────────────────────── Pastille décorative ───────────────────────────

/**
 * Pastille « scope accordé » en lecture seule — pédagogique : on indique
 * visuellement que l'accès est demandé. Icône Check violette dans un cercle
 * violet pâle, pas d'interaction.
 */
function ScopeBadge({ className, ariaLabel }: { className?: string; ariaLabel: string }) {
  return (
    <span
      role="img"
      aria-label={ariaLabel}
      className={cn(
        'inline-flex size-5 shrink-0 items-center justify-center rounded-full',
        'bg-primary/15 ring-1 ring-primary/30',
        'text-primary',
        className,
      )}
    >
      <Check className="size-3" aria-hidden />
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
  userName,
  onConfirm,
  onCancel,
}: Ec32OAuthConsentProps) {
  const t = useTranslations('public.ec32')
  const displayName = userName ?? t('oauthConsent.defaultUserName')
  return (
    <Ec32Card className="mx-auto max-w-2xl space-y-3.5 p-4 md:p-5">
      {/* En-tête : pastille décorative violette + eyebrow */}
      <header className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <Ec32Eyebrow>
            <ShieldCheck className="size-3.5" aria-hidden />
            {t('oauthConsent.eyebrow')}
          </Ec32Eyebrow>
          <span
            aria-hidden
            className="inline-flex size-9 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/20"
          >
            <ShieldCheck className="size-[1.1rem] text-primary" />
          </span>
        </div>

        <div className="space-y-1">
          <h2 className="text-lg font-bold leading-tight tracking-tight text-foreground md:text-xl">
            {t('oauthConsent.greeting', { userName: displayName })}
          </h2>
          <p className="text-[0.8rem] leading-snug text-muted-foreground">
            {t.rich('oauthConsent.intro', {
              app: (chunks) => (
                <span className="font-semibold text-foreground">{chunks}</span>
              ),
            })}
          </p>
        </div>
      </header>

      {/* Liste des 7 scopes */}
      <ul className="space-y-1.5">
        {SCOPES.map((scope) => (
          <li
            key={scope.titleKey}
            className={cn(
              'flex items-start gap-2.5 rounded-xl border border-primary/10 bg-card/60 p-2.5',
              'shadow-[0_1px_2px_rgba(26,26,36,0.03)]',
            )}
          >
            <ScopeBadge className="mt-0.5" ariaLabel={t('oauthConsent.scopeBadgeAriaLabel')} />
            <div className="min-w-0 flex-1">
              <p className="text-[0.8rem] font-semibold leading-snug text-foreground">
                {t(scope.titleKey as Parameters<typeof t>[0])}
              </p>
              <p className="text-[0.74rem] leading-snug text-muted-foreground">
                {t(scope.descriptionKey as Parameters<typeof t>[0])}
              </p>
            </div>
          </li>
        ))}
      </ul>

      {/* Encadré durée de validité */}
      <Ec32InfoBox tone="info" icon={Hourglass} className="p-3">
        {t.rich('oauthConsent.validity', {
          duration: (chunks) => <strong>{chunks}</strong>,
        })}
      </Ec32InfoBox>

      {/* Actions */}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          className="sm:min-w-32"
        >
          {t('oauthConsent.cancel')}
        </Button>
        <Button
          type="button"
          variant="default"
          onClick={onConfirm}
          className="sm:min-w-32"
        >
          {t('oauthConsent.confirm')}
        </Button>
      </div>

      {/* Pied de page pédagogique */}
      <p className="border-t border-primary/10 pt-2.5 text-center text-[0.7rem] italic text-muted-foreground">
        {t('oauthConsent.footer')}
      </p>
    </Ec32Card>
  )
}

export default Ec32OAuthConsent
