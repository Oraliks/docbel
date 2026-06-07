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
  onOpenChange,
  onConfirm,
}: {
  target: ImpersonationTarget | null
  onOpenChange: (open: boolean) => void
  onConfirm: (reason: string) => Promise<void> | void
}) {
  const [reason, setReason] = useState("")
  const [submitting, setSubmitting] = useState(false)

  // Reset le champ quand on change de target (ou quand on rouvre).
  useEffect(() => {
    if (target) setReason("")
  }, [target?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const trimmed = reason.trim()
  const isValid = trimmed.length >= MIN_REASON_LENGTH

  const handleSubmit = async () => {
    if (!isValid || !target) return
    setSubmitting(true)
    try {
      await onConfirm(trimmed)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog
      open={target !== null}
      onOpenChange={(open) => {
        if (submitting) return // empêche fermeture pendant le fetch
        onOpenChange(open)
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Confirmer l&apos;impersonation</DialogTitle>
          <DialogDescription>
            {target && (
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
            )}
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
            placeholder="Ex: Debug bug #1234 remonté par le user…"
            rows={3}
            disabled={submitting}
          />
          <p className="text-xs text-muted-foreground">
            {trimmed.length} / {MIN_REASON_LENGTH} caractères minimum
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
