'use client'

// =====================================================================
//  eC3.2 — Modale d'envoi simulé
// ---------------------------------------------------------------------
//  - Non affilié à un organisme de paiement → variante « Envoi impossible ».
//  - Sinon : confirmation → succès (la carte passe en `sent`/`locked`).
//  Aucune donnée réelle n'est jamais transmise. 100 % pédagogique.
// =====================================================================

import { useEffect, useState } from 'react'
import { Ban, CheckCircle2, Send } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Ec32InfoBox } from '@/components/docbel/ec32/ui'

export interface Ec32SendModalLabels {
  title: string
  body: string
  cancelLabel: string
  confirmLabel: string
  successTitle: string
  successBody: string
  blockedTitle: string
  blockedBody: string
}

export function Ec32SendModal({
  open,
  affiliated,
  labels,
  onOpenChange,
  onConfirm,
}: {
  open: boolean
  /** Affilié à un organisme de paiement : si faux, envoi bloqué. */
  affiliated: boolean
  labels: Ec32SendModalLabels
  onOpenChange: (open: boolean) => void
  /** Appelé après confirmation : la carte passe en `sent`/`locked`. */
  onConfirm: () => void
}) {
  const [confirmed, setConfirmed] = useState(false)

  // Repart de l'écran de confirmation à chaque ouverture.
  useEffect(() => {
    if (open) setConfirmed(false)
  }, [open])

  const handleConfirm = (): void => {
    onConfirm()
    setConfirmed(true)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {!affiliated ? (
          // ── Variante bloquée ──
          <>
            <DialogHeader>
              <DialogTitle>{labels.blockedTitle}</DialogTitle>
              <DialogDescription className="sr-only">
                {labels.blockedTitle}
              </DialogDescription>
            </DialogHeader>
            <Ec32InfoBox tone="warning" icon={Ban}>
              {labels.blockedBody}
            </Ec32InfoBox>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {labels.cancelLabel}
              </Button>
            </DialogFooter>
          </>
        ) : confirmed ? (
          // ── Succès ──
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle2 className="size-5 text-emerald-600 dark:text-emerald-400" aria-hidden />
                {labels.successTitle}
              </DialogTitle>
              <DialogDescription>{labels.successBody}</DialogDescription>
            </DialogHeader>
            <Ec32InfoBox tone="success">
              Rappel : cette simulation n’envoie jamais aucune donnée réelle à l’ONEM.
            </Ec32InfoBox>
            <DialogFooter>
              <Button type="button" onClick={() => onOpenChange(false)}>
                Fermer
              </Button>
            </DialogFooter>
          </>
        ) : (
          // ── Confirmation ──
          <>
            <DialogHeader>
              <DialogTitle>{labels.title}</DialogTitle>
              <DialogDescription>{labels.body}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {labels.cancelLabel}
              </Button>
              <Button type="button" onClick={handleConfirm}>
                <Send className="size-4" aria-hidden />
                {labels.confirmLabel}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
