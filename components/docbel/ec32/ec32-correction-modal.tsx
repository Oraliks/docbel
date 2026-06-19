'use client'

// =====================================================================
//  eC3.2 — Modale « Corriger la situation »
// ---------------------------------------------------------------------
//  Jour concerné, ancienne situation (lecture seule), nouvelle situation
//  (Select), explication OBLIGATOIRE (Textarea). Le bouton est désactivé
//  tant que l'explication est vide. Carte envoyée/verrouillée : message
//  de verrouillage, aucune édition. 100 % pédagogique.
// =====================================================================

import { useEffect, useState } from 'react'
import { Lock } from 'lucide-react'
import {
  EC32_SELECTABLE_SITUATIONS,
  type Ec32SituationType,
} from '@/lib/ec32/types'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Ec32InfoBox, Ec32SituationChip } from '@/components/docbel/ec32/ui'

export interface Ec32CorrectionModalLabels {
  title: string
  helpText: string
  dayLabel: string
  fromLabel: string
  toLabel: string
  reasonLabel: string
  reasonPlaceholder: string
  saveLabel: string
  lockedMessage: string
  requiredError: string
}

export function Ec32CorrectionModal({
  open,
  locked,
  dayLabel,
  currentSituation,
  labels,
  situationLabel,
  onOpenChange,
  onSave,
}: {
  open: boolean
  /** Carte envoyée/verrouillée : pas d'édition. */
  locked: boolean
  /** Date lisible du jour concerné (p. ex. « jeu. 8 mai 2025 »). */
  dayLabel: string
  currentSituation: Ec32SituationType
  labels: Ec32CorrectionModalLabels
  situationLabel: (situation: Ec32SituationType) => string
  onOpenChange: (open: boolean) => void
  onSave: (to: Ec32SituationType, reason: string) => void
}) {
  const [to, setTo] = useState<Ec32SituationType>(currentSituation)
  const [reason, setReason] = useState('')
  const [touched, setTouched] = useState(false)

  // Réinitialise les champs à chaque ouverture / changement de jour.
  useEffect(() => {
    if (open) {
      setTo(currentSituation)
      setReason('')
      setTouched(false)
    }
  }, [open, currentSituation, dayLabel])

  const reasonEmpty = reason.trim().length === 0

  const handleSave = (): void => {
    setTouched(true)
    if (reasonEmpty) return
    onSave(to, reason.trim())
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{labels.title}</DialogTitle>
          <DialogDescription>{labels.helpText}</DialogDescription>
        </DialogHeader>

        {locked ? (
          <Ec32InfoBox tone="warning" icon={Lock} title={labels.lockedMessage}>
            Une carte envoyée ne peut plus être modifiée dans la simulation.
          </Ec32InfoBox>
        ) : (
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {labels.dayLabel}
              </p>
              <p className="mt-1 text-sm font-medium text-foreground">{dayLabel}</p>
            </div>

            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {labels.fromLabel}
              </p>
              <Ec32SituationChip
                situation={currentSituation}
                label={situationLabel(currentSituation)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ec32-correction-to">{labels.toLabel}</Label>
              <Select
                value={to}
                onValueChange={(v) => v && setTo(v as Ec32SituationType)}
              >
                <SelectTrigger id="ec32-correction-to" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EC32_SELECTABLE_SITUATIONS.map((situation) => (
                    <SelectItem key={situation} value={situation}>
                      {situationLabel(situation)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ec32-correction-reason">{labels.reasonLabel}</Label>
              <Textarea
                id="ec32-correction-reason"
                value={reason}
                placeholder={labels.reasonPlaceholder}
                aria-invalid={touched && reasonEmpty}
                aria-describedby={
                  touched && reasonEmpty ? 'ec32-correction-error' : undefined
                }
                onChange={(e) => setReason(e.target.value)}
                onBlur={() => setTouched(true)}
              />
              {touched && reasonEmpty && (
                <p id="ec32-correction-error" className="text-xs font-medium text-destructive">
                  {labels.requiredError}
                </p>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Fermer
          </Button>
          {!locked && (
            <Button type="button" onClick={handleSave} disabled={reasonEmpty}>
              {labels.saveLabel}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
