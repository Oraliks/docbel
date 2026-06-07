"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

/// Forme minimale d'un target — partagée entre ViewAsMenu (comptes demo +
/// résultats de search) et ImpersonationBanner (switcher).
export type ImpersonationTarget = {
  id: string
  email: string
  name: string
  role: string
  partnerOrganization: string | null
}

const ROLE_LABELS: Record<string, string> = {
  user: "Citoyen",
  partner: "Partenaire",
  employer: "Employeur",
}

const MIN_REASON_LENGTH = 10

/// Modal shadcn de confirmation d'impersonation avec saisie de raison.
/// Remplace l'ancien window.prompt côté UX (cf. /admin/impersonation pour
/// l'audit log alimenté par AdminImpersonationLog.reason).
///
/// Comportement :
///   - target=null → fermé
///   - target=<account> → ouvert, focus sur le textarea, bouton "Confirmer"
///     désactivé tant que reason.trim().length < 10
///   - onConfirm reçoit la raison nettoyée (trim) ; sa Promise tient le
///     bouton "Confirmation…" jusqu'à résolution (l'appelant gère la fermeture
///     via onOpenChange après son fetch).
export function ImpersonationReasonDialog({
  target,
  visitorMode = false,
  reasonOptional = false,
  onOpenChange,
  onConfirm,
}: {
  target: ImpersonationTarget | null
  /// true = dialog en mode "visiteur anonyme" (#3 + #7) : pas de target
  /// (l'admin va se déconnecter), header dédié, confirmation explicite +
  /// raison. Si visitorMode=true et target=null, le dialog est OUVERT.
  visitorMode?: boolean
  /// true = saisie de raison facultative (dev uniquement). Confirmer reste
  /// actif même avec un textarea vide. Sert pour le confirm simple "Visiteur"
  /// en dev sans encombrer le solo dev.
  reasonOptional?: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (reason: string) => Promise<void> | void
}) {
  const [reason, setReason] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const isOpen = target !== null || visitorMode === true

  // Reset le champ quand on change de target (ou quand on rouvre).
  useEffect(() => {
    if (isOpen) setReason("")
  }, [target?.id, visitorMode, isOpen]) // eslint-disable-line react-hooks/exhaustive-deps

  const trimmed = reason.trim()
  const isValid = reasonOptional || trimmed.length >= MIN_REASON_LENGTH

  const handleSubmit = async () => {
    if (!isValid || !isOpen) return
    setSubmitting(true)
    try {
      await onConfirm(trimmed)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (submitting) return // empêche fermeture pendant le fetch
        onOpenChange(open)
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {visitorMode
              ? "Basculer en visiteur anonyme"
              : "Confirmer l’impersonation"}
          </DialogTitle>
          <DialogDescription>
            {visitorMode ? (
              <>
                Tu vas être <strong>déconnecté</strong> du shell admin pour
                voir le site comme un visiteur public. La session admin
                reste vivante (cookie stash) — un clic sur «&nbsp;Revenir
                admin&nbsp;» te ramène sans saisir ton mot de passe.
              </>
            ) : target ? (
              <>
                Tu vas voir le site comme{" "}
                <strong>{target.name || target.email}</strong>{" "}
                <span className="text-muted-foreground">
                  ({ROLE_LABELS[target.role] || target.role}
                  {target.partnerOrganization
                    ? ` · ${target.partnerOrganization}`
                    : ""}
                  )
                </span>
                .
              </>
            ) : null}
            <br />
            Indique brièvement pourquoi — la raison est tracée dans l&apos;audit
            log.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          <Label htmlFor="impersonation-reason" className="text-sm">
            Raison
          </Label>
          <Textarea
            id="impersonation-reason"
            autoFocus
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={
              reasonOptional
                ? "Optionnel en dev — laisse vide ou note pourquoi…"
                : "Ex: Debug bug #1234 remonté par le user…"
            }
            rows={3}
            disabled={submitting}
          />
          <p className="text-xs text-muted-foreground">
            {reasonOptional
              ? "Facultatif (dev)"
              : `${trimmed.length} / ${MIN_REASON_LENGTH} caractères minimum`}
          </p>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            disabled={submitting}
            onClick={() => onOpenChange(false)}
          >
            Annuler
          </Button>
          <Button disabled={!isValid || submitting} onClick={handleSubmit}>
            {submitting ? "Confirmation…" : "Confirmer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export const IMPERSONATION_REASON_MIN_LENGTH = MIN_REASON_LENGTH
