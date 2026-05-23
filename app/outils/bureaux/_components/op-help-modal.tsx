'use client'

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
import { Building2, Users, ExternalLink, Info } from 'lucide-react'

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
}

/**
 * Modal éducative "Quel organisme de paiement choisir ?".
 * Explique la différence CAPAC (public) vs syndicats (FGTB/CSC/CGSLB) :
 * conditions, cotisation, services associés. Aide le user à savoir lequel
 * choisir avant de cliquer sur un tab.
 */
export function OpHelpModal({ open, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="data-[size=default]:sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Quel organisme de paiement choisir&nbsp;?</DialogTitle>
          <DialogDescription>
            En Belgique, tu as 4 organismes possibles pour recevoir tes allocations
            de chômage. Le choix t&apos;appartient — voici comment décider.
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
              <h3 className="font-semibold text-sm">CAPAC</h3>
              <Badge variant="secondary" className="text-[10px]">
                Organisme public
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              La <strong>Caisse Auxiliaire de Paiement des Allocations de Chômage</strong>{' '}
              est l&apos;organisme public, géré par l&apos;État. Sans cotisation,
              gratuit. Ne fournit que le paiement des allocations — pas de défense
              juridique ni de services syndicaux.
            </p>
            <p className="text-[11px] text-muted-foreground">
              <strong>Pour qui&nbsp;?</strong> Tu ne veux pas adhérer à un syndicat,
              ou tu cherches le plus simple et neutre.
            </p>
          </div>

          {/* Syndicats */}
          <div className="rounded-lg border bg-card p-4 space-y-2">
            <div className="flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-md bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300">
                <Users className="size-4" />
              </span>
              <h3 className="font-semibold text-sm">FGTB · CSC · CGSLB</h3>
              <Badge variant="secondary" className="text-[10px]">
                Syndicats
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Les 3 syndicats belges paient aussi les allocations à leurs membres,
              et offrent en plus la <strong>défense juridique</strong>, le conseil
              en droit du travail, et l&apos;accompagnement. <strong>Cotisation
              mensuelle</strong> (~15-20 €/mois selon syndicat et statut).
            </p>
            <ul className="text-[11px] text-muted-foreground space-y-1 pl-4 list-disc">
              <li>
                <strong>FGTB</strong> (Fédération Générale du Travail de Belgique)
                — socialiste, plus présent en industrie
              </li>
              <li>
                <strong>CSC</strong> (Confédération des Syndicats Chrétiens) — plus
                gros syndicat belge
              </li>
              <li>
                <strong>CGSLB</strong> (Centrale Générale des Syndicats Libéraux de
                Belgique) — libéral, plus petit
              </li>
            </ul>
            <p className="text-[11px] text-muted-foreground">
              <strong>Pour qui&nbsp;?</strong> Tu veux un soutien actif (litige
              employeur, négociation, conseil) en plus du paiement.
            </p>
          </div>

          {/* Comment savoir */}
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Info className="size-4 text-primary" />
              <h3 className="font-semibold text-sm">
                Tu ne sais pas si tu es déjà affilié&nbsp;?
              </h3>
            </div>
            <ul className="text-xs text-muted-foreground space-y-1.5 pl-4 list-disc">
              <li>
                Regarde ta fiche de paie — la retenue syndicale est mentionnée si tu
                cotises à un syndicat
              </li>
              <li>
                Demande aux RH de ton ancien employeur — ils savent souvent
              </li>
              <li>
                Si tu n&apos;es affilié à aucun, la <strong>CAPAC</strong> est le
                défaut le plus rapide à activer
              </li>
            </ul>
          </div>
        </div>

        <DialogFooter className="flex sm:justify-between gap-2 flex-wrap">
          <p className="text-[10px] text-muted-foreground italic">
            Source&nbsp;:{' '}
            <a
              href="https://www.onem.be/citoyens/chomage/admission-au-droit/votre-organisme-de-paiement"
              target="_blank"
              rel="noreferrer"
              className="underline inline-flex items-center gap-0.5"
            >
              ONEM <ExternalLink className="size-2.5" />
            </a>
          </p>
          <Button onClick={() => onOpenChange(false)} variant="outline" size="sm">
            J&apos;ai compris
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
