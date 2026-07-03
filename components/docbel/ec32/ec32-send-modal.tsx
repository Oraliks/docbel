'use client'

// =====================================================================
//  eC3.2 — Modale d'envoi simulé
// ---------------------------------------------------------------------
//  Reproduit fidèlement le parcours réel :
//   - Non affilié à un organisme de paiement → variante « Envoi impossible ».
//   - Sinon : confirmation (texte verbatim ONEM) → succès. Sur le succès,
//     l'utilisateur peut télécharger le PDF UNIQUEMENT avant de revenir à
//     l'Accueil ; après ce clic, la possibilité disparaît (comme dans la
//     vraie app eC3.2). Aucune donnée réelle n'est jamais transmise.
// =====================================================================

import { useEffect, useState } from 'react'
import { Ban, CheckCircle2, Download, Home, Send } from 'lucide-react'
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
  monthLabel,
  employerName,
  paymentOrgName,
  onOpenChange,
  onConfirm,
  onDownloadPdf,
}: {
  open: boolean
  /** Affilié à un organisme de paiement : si faux, envoi bloqué. */
  affiliated: boolean
  labels: Ec32SendModalLabels
  /** Mois (ex. « mai 2025 ») — injecté dans le texte verbatim ONEM. */
  monthLabel?: string
  /** Nom de l'employeur — injecté dans le texte verbatim ONEM. */
  employerName?: string
  /** Organisme de paiement (CAPAC/CSC/FGTB/SYNOVA) — défaut neutre. */
  paymentOrgName?: string
  onOpenChange: (open: boolean) => void
  /** Appelé après confirmation : la carte passe en `sent`/`locked`. */
  onConfirm: () => void
  /** Action de téléchargement PDF post-envoi (avant retour Accueil). */
  onDownloadPdf?: () => void
}) {
  const [confirmed, setConfirmed] = useState(false)
  // Verrouille la possibilité de télécharger le PDF une fois Accueil cliqué
  // (comme dans la vraie app : « Dès que vous aurez cliqué sur Accueil,
  // ce ne sera plus possible. »).
  const [homeClicked, setHomeClicked] = useState(false)

  // Repart de l'écran de confirmation à chaque ouverture.
  useEffect(() => {
    if (open) {
      setConfirmed(false)
      setHomeClicked(false)
    }
  }, [open])

  const handleConfirm = (): void => {
    onConfirm()
    setConfirmed(true)
  }

  // Texte verbatim ONEM si on a les infos contextuelles, sinon fallback labels.
  const orgLabel = paymentOrgName?.trim() || 'votre organisme de paiement'
  const monthText = monthLabel?.trim()
  const employerText = employerName?.trim()
  const confirmBody =
    monthText && employerText
      ? `Vous êtes sur le point d’envoyer votre carte de contrôle eC3.2 pour ${monthText} (${employerText}) à ${orgLabel}. Par la suite, vous n’aurez plus la possibilité d’adapter votre carte de contrôle. Vérifiez donc que vous l’avez remplie de manière correcte et complète avant de l’envoyer.`
      : labels.body
  const successBody = monthText
    ? `Votre carte de contrôle électronique pour ${monthText} pour cet employeur a été envoyée à votre organisme de paiement. Pour l’instant, vous avez encore la possibilité de télécharger vous-même la carte de contrôle au format PDF. Dès que vous aurez cliqué sur « Accueil », ce ne sera plus possible.`
    : labels.successBody

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
              <DialogDescription>{successBody}</DialogDescription>
            </DialogHeader>
            {homeClicked && (
              <Ec32InfoBox tone="warning">
                Vous êtes retourné à l’accueil : il n’est plus possible de
                télécharger la carte au format PDF.
              </Ec32InfoBox>
            )}
            <Ec32InfoBox tone="success">
              Rappel : cette simulation n’envoie jamais aucune donnée réelle à l’ONEM.
            </Ec32InfoBox>
            <DialogFooter className="gap-2 sm:gap-2">
              {onDownloadPdf && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={onDownloadPdf}
                  disabled={homeClicked}
                  aria-disabled={homeClicked}
                >
                  <Download className="size-4" aria-hidden />
                  Télécharger le PDF
                </Button>
              )}
              <Button
                type="button"
                onClick={() => {
                  setHomeClicked(true)
                  onOpenChange(false)
                }}
              >
                <Home className="size-4" aria-hidden />
                Accueil
              </Button>
            </DialogFooter>
          </>
        ) : (
          // ── Confirmation ──
          <>
            <DialogHeader>
              <DialogTitle>{labels.title}</DialogTitle>
              <DialogDescription>{confirmBody}</DialogDescription>
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
