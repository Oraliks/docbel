'use client'

import { useTranslations } from 'next-intl'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Building2, Users, Info } from 'lucide-react'

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
}

/**
 * Modal éducative "Quel organisme de paiement choisir ?".
 * Explique la différence CAPAC (public) vs syndicats (FGTB/CSC/SYNOVA) :
 * conditions, cotisation, services associés. Aide le user à savoir lequel
 * choisir avant de cliquer sur un tab.
 */
export function OpHelpModal({ open, onOpenChange }: Props) {
  const t = useTranslations('public.outils')
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        // Élargit au-delà du défaut sm:max-w-lg. Le préfixe doit être sm: (avec
        // ! pour la priorité), sinon le défaut responsive recoiffe à ≥640px.
        className="sm:!max-w-[min(calc(100%-2rem),720px)] max-h-[85vh] overflow-y-auto"
      >
        <DialogHeader>
          <DialogTitle>{t('ophTitle')}</DialogTitle>
          <DialogDescription>
            {t('ophIntro')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* CAPAC */}
          <div className="rounded-lg border bg-card p-4 space-y-2">
            <div className="flex items-center gap-2">
              <span
                className="flex size-8 items-center justify-center rounded-md text-white"
                style={{ background: '#003E7E' }}
              >
                <Building2 className="size-4" />
              </span>
              <h3 className="font-semibold text-sm">{t('ophCapacName')}</h3>
              <Badge variant="secondary" className="text-[10px]">
                {t('ophCapacBadge')}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {t.rich('ophCapacBody', { strong: (c) => <strong>{c}</strong> })}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {t.rich('ophCapacFor', { strong: (c) => <strong>{c}</strong> })}
            </p>
          </div>

          {/* Syndicats */}
          <div className="rounded-lg border bg-card p-4 space-y-2">
            <div className="flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-md bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300">
                <Users className="size-4" />
              </span>
              <h3 className="font-semibold text-sm">{t('ophSyndicatNames')}</h3>
              <Badge variant="secondary" className="text-[10px]">
                {t('ophSyndicatBadge')}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {t.rich('ophSyndicatBody', { strong: (c) => <strong>{c}</strong> })}
            </p>
            <ul className="text-[11px] text-muted-foreground space-y-1 pl-4 list-disc">
              <li>
                {t.rich('ophSyndicatFgtb', { strong: (c) => <strong>{c}</strong> })}
              </li>
              <li>
                {t.rich('ophSyndicatCsc', { strong: (c) => <strong>{c}</strong> })}
              </li>
              <li>
                {t.rich('ophSyndicatSynova', { strong: (c) => <strong>{c}</strong> })}
              </li>
            </ul>
            <p className="text-[11px] text-muted-foreground">
              {t.rich('ophSyndicatFor', { strong: (c) => <strong>{c}</strong> })}
            </p>
          </div>

          {/* Comment savoir */}
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Info className="size-4 text-primary" />
              <h3 className="font-semibold text-sm">
                {t('ophUnknownTitle')}
              </h3>
            </div>
            <ul className="text-xs text-muted-foreground space-y-1.5 pl-4 list-disc">
              <li>{t('ophUnknownBullet1')}</li>
              <li>{t('ophUnknownBullet2')}</li>
              <li>
                {t.rich('ophUnknownBullet3', { strong: (c) => <strong>{c}</strong> })}
              </li>
            </ul>
          </div>
        </div>

        <DialogFooter className="flex sm:justify-between gap-2 flex-wrap">
          <p className="text-[10px] text-muted-foreground italic">
            {t('ophSource')}
          </p>
          <Button onClick={() => onOpenChange(false)} variant="outline" size="sm">
            {t('ophGotIt')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
