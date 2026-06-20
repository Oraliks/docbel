'use client'

// =====================================================================
//  eC3.2 — Wizard "Nouvelle demande d'accès" (3 étapes)
// ---------------------------------------------------------------------
//  Étape 1 : périmètre des données (case à cocher unique).
//  Étape 2 : durée souhaitée (1 an max / jusqu'au).
//  Étape 3 : destinataire (nom, langue, mode de transmission).
//  Aucune donnée n'est envoyée — 100 % pédagogique. Le bouton final
//  affiche un encadré succès puis appelle `onSubmitted(draft)`.
// =====================================================================

import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Layers,
  Link as LinkIcon,
  Mail,
  QrCode,
  Send,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import { Ec32InfoBox } from '@/components/docbel/ec32/ui'
import type {
  Ec32MandateDraft,
  Ec32MandateLanguage,
  Ec32MandateTransmissionChannel,
} from './types'

// ─────────────────────────── État initial ───────────────────────────

const INITIAL_DRAFT: Ec32MandateDraft = {
  scope: null,
  durationMode: 'max_1y',
  durationUntil: null,
  personName: '',
  personEmail: '',
  language: 'fr',
  channel: null,
}

const STEPS = [
  { id: 1, label: 'À quelles données voulez-vous accéder ?' },
  { id: 2, label: 'Durée souhaitée de l’accès' },
  { id: 3, label: 'Envoyer la demande d’accès' },
] as const

type StepNumber = (typeof STEPS)[number]['id']

// ─────────────────────────── Helpers ───────────────────────────

function isValidEmail(value: string): boolean {
  // validation très basique
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

// ─────────────────────────── Sous-composants visuels ───────────────────────────

function Stepper({ current }: { current: StepNumber }) {
  return (
    <ol className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
      {STEPS.map((step, idx) => {
        const isActive = step.id === current
        const isDone = step.id < current
        return (
          <li key={step.id} className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span
                aria-hidden
                className={cn(
                  'flex size-7 items-center justify-center rounded-full text-xs font-bold transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : isDone
                      ? 'bg-primary/15 text-primary'
                      : 'bg-muted text-muted-foreground',
                )}
              >
                {step.id}
              </span>
              <span
                className={cn(
                  'text-xs font-medium sm:text-sm',
                  isActive
                    ? 'text-primary'
                    : isDone
                      ? 'text-foreground'
                      : 'text-muted-foreground',
                )}
              >
                {step.label}
              </span>
            </div>
            {idx < STEPS.length - 1 && (
              <span
                aria-hidden
                className="hidden h-px w-6 bg-border sm:inline-block"
              />
            )}
          </li>
        )
      })}
    </ol>
  )
}

function RadioOption({
  checked,
  onChange,
  label,
  description,
  icon,
  name,
  value,
}: {
  checked: boolean
  onChange: () => void
  label: ReactNode
  description?: ReactNode
  icon?: ReactNode
  name: string
  value: string
}) {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-start gap-3 rounded-2xl border bg-card p-4 transition-colors',
        checked
          ? 'border-primary/50 bg-primary/5'
          : 'border-primary/10 hover:border-primary/30',
      )}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        className="mt-1 size-4 accent-[var(--primary)]"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm font-medium text-foreground">{label}</span>
        </div>
        {description && (
          <div className="mt-1 text-xs text-muted-foreground">{description}</div>
        )}
      </div>
    </label>
  )
}

// ─────────────────────────── Étape 1 ───────────────────────────

function StepScope({
  draft,
  onChange,
}: {
  draft: Ec32MandateDraft
  onChange: (next: Ec32MandateDraft) => void
}) {
  const isChecked = draft.scope === 'temporary_unemployment_card'
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Choisissez les données auxquelles vous souhaitez donner accès.
      </p>
      <label
        className={cn(
          'flex cursor-pointer items-start gap-3 rounded-2xl border bg-card p-4 transition-colors',
          isChecked
            ? 'border-primary/50 bg-primary/5'
            : 'border-primary/10 hover:border-primary/30',
        )}
      >
        <Checkbox
          className="mt-0.5"
          checked={isChecked}
          onCheckedChange={(value) =>
            onChange({
              ...draft,
              scope: value === true ? 'temporary_unemployment_card' : null,
            })
          }
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Layers className="size-4 text-primary" aria-hidden />
            <span className="text-sm font-medium text-foreground">
              Carte de chômage temporaire
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            La personne pourra consulter et compléter votre carte mensuelle.
          </p>
        </div>
      </label>
    </div>
  )
}

// ─────────────────────────── Étape 2 ───────────────────────────

function StepDuration({
  draft,
  onChange,
}: {
  draft: Ec32MandateDraft
  onChange: (next: Ec32MandateDraft) => void
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Indiquez pendant combien de temps l&apos;accès doit rester valide.
      </p>
      <div className="space-y-3">
        <RadioOption
          name="duration"
          value="max_1y"
          checked={draft.durationMode === 'max_1y'}
          onChange={() => onChange({ ...draft, durationMode: 'max_1y', durationUntil: null })}
          label="Durée maximale : 1 an"
          description="L'accès se termine automatiquement au bout d'un an."
        />
        <RadioOption
          name="duration"
          value="until"
          checked={draft.durationMode === 'until'}
          onChange={() => onChange({ ...draft, durationMode: 'until' })}
          label="Jusqu'au"
          description={
            <div className="mt-2">
              <input
                type="date"
                disabled={draft.durationMode !== 'until'}
                value={draft.durationUntil ?? ''}
                onChange={(e) =>
                  onChange({ ...draft, durationUntil: e.target.value || null })
                }
                className={cn(
                  'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground transition-colors',
                  'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
                  'disabled:cursor-not-allowed disabled:opacity-50',
                )}
              />
            </div>
          }
        />
      </div>
      <Ec32InfoBox tone="info" title="Durée limitée">
        La consultation des données de la Carte de chômage temporaire est limitée à 1 an
        maximum.
      </Ec32InfoBox>
    </div>
  )
}

// ─────────────────────────── Étape 3 ───────────────────────────

const LANGUAGE_OPTIONS: Array<{ id: Ec32MandateLanguage; label: string }> = [
  { id: 'nl', label: 'NL' },
  { id: 'fr', label: 'FR' },
  { id: 'de', label: 'DE' },
]

/** Motif décoratif fixe pour le faux QR (5×5, true = case noire). */
const QR_PATTERN: boolean[] = [
  true, true, true, false, true,
  true, false, true, false, true,
  true, true, false, true, false,
  false, false, true, true, true,
  true, false, true, false, true,
]

/** Lien fictif + bouton « Copier » (simulation, aucun lien réel). */
function LinkPreview() {
  const [copied, setCopied] = useState(false)
  const fakeLink = 'https://acces.simulation.docbel/mandat/ec32?demo=1'
  const handleCopy = () => {
    try {
      void navigator.clipboard?.writeText(fakeLink)
      setCopied(true)
    } catch {
      setCopied(true)
    }
  }
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-primary/10 bg-card p-4 sm:flex-row sm:items-center">
      <code className="min-w-0 flex-1 truncate rounded-lg bg-muted/60 px-3 py-2 text-xs text-foreground">
        {fakeLink}
      </code>
      <Button type="button" variant="outline" size="sm" onClick={handleCopy}>
        {copied ? 'Copié ✓' : 'Copier le lien'}
      </Button>
    </div>
  )
}

function StepSend({
  draft,
  onChange,
}: {
  draft: Ec32MandateDraft
  onChange: (next: Ec32MandateDraft) => void
}) {
  return (
    <div className="space-y-5">
      {/* Identité du destinataire */}
      <div className="space-y-2">
        <label
          htmlFor="mandate-person-name"
          className="text-sm font-medium text-foreground"
        >
          Prénom et nom
        </label>
        <input
          id="mandate-person-name"
          type="text"
          autoComplete="off"
          value={draft.personName}
          onChange={(e) => onChange({ ...draft, personName: e.target.value })}
          placeholder="Ex. Karim Benali"
          className={cn(
            'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground transition-colors',
            'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
          )}
        />
      </div>

      {/* Langue */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">Langue de la demande</p>
        <div role="radiogroup" aria-label="Langue" className="flex flex-wrap gap-2">
          {LANGUAGE_OPTIONS.map((opt) => {
            const isActive = draft.language === opt.id
            return (
              <button
                key={opt.id}
                type="button"
                role="radio"
                aria-checked={isActive}
                onClick={() => onChange({ ...draft, language: opt.id })}
                className={cn(
                  'rounded-full border px-4 py-1.5 text-xs font-semibold transition-colors',
                  isActive
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-primary/15 bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground',
                )}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Mode de transmission */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">Mode de transmission</p>
        <div className="space-y-3">
          <RadioOption
            name="channel"
            value="email"
            checked={draft.channel === 'email'}
            onChange={() => onChange({ ...draft, channel: 'email' })}
            icon={<Mail className="size-4 text-primary" aria-hidden />}
            label="Par e-mail"
            description={
              draft.channel === 'email' ? (
                <div className="mt-2 space-y-1">
                  <input
                    type="email"
                    autoComplete="off"
                    value={draft.personEmail}
                    onChange={(e) => onChange({ ...draft, personEmail: e.target.value })}
                    placeholder="prenom.nom@exemple.be"
                    className={cn(
                      'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground transition-colors',
                      'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
                    )}
                  />
                  {draft.personEmail.length > 0 && !isValidEmail(draft.personEmail) && (
                    <p className="text-xs text-red-600">
                      Indiquez une adresse e-mail valide.
                    </p>
                  )}
                </div>
              ) : (
                'Le citoyen recevra la demande par e-mail.'
              )
            }
          />
          <RadioOption
            name="channel"
            value="qr"
            checked={draft.channel === 'qr'}
            onChange={() => onChange({ ...draft, channel: 'qr' })}
            icon={<QrCode className="size-4 text-primary" aria-hidden />}
            label="Via code QR"
            description="Un code QR à scanner sera affiché à l'écran."
          />
          <RadioOption
            name="channel"
            value="link"
            checked={draft.channel === 'link'}
            onChange={() => onChange({ ...draft, channel: 'link' })}
            icon={<LinkIcon className="size-4 text-primary" aria-hidden />}
            label="Via lien"
            description="Un lien personnel à partager par le canal de votre choix."
          />
        </div>

        {/* Aperçu du canal choisi (QR / lien) — décoratif, pédagogique. */}
        {draft.channel === 'qr' && (
          <div className="flex items-center gap-4 rounded-2xl border border-primary/10 bg-card p-4">
            <div
              aria-hidden
              className="grid size-20 shrink-0 grid-cols-5 grid-rows-5 gap-0.5 rounded-lg border border-border bg-white p-1.5"
            >
              {QR_PATTERN.map((on, i) => (
                <span
                  key={i}
                  className={cn('rounded-[1px]', on ? 'bg-foreground' : 'bg-transparent')}
                />
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Demandez à la personne de scanner ce code QR avec son smartphone.
              <span className="mt-1 block italic">Code illustratif (simulation).</span>
            </p>
          </div>
        )}
        {draft.channel === 'link' && <LinkPreview />}
      </div>

      <Ec32InfoBox tone="info">
        Aucune donnée n&apos;est réellement transmise — cet écran illustre le parcours de
        mandat eC3.2. La demande créée apparaîtra dans « Accès demandés ».
      </Ec32InfoBox>
    </div>
  )
}

// ─────────────────────────── Composant principal ───────────────────────────

export interface Ec32MandateWizardProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmitted?: (draft: Ec32MandateDraft) => void
}

export function Ec32MandateWizard({
  open,
  onOpenChange,
  onSubmitted,
}: Ec32MandateWizardProps) {
  const [step, setStep] = useState<StepNumber>(1)
  const [draft, setDraft] = useState<Ec32MandateDraft>(INITIAL_DRAFT)

  // Reset au montage / chaque réouverture
  useEffect(() => {
    if (open) {
      setStep(1)
      setDraft(INITIAL_DRAFT)
    }
  }, [open])

  const canGoNext = useMemo<boolean>(() => {
    if (step === 1) return draft.scope === 'temporary_unemployment_card'
    if (step === 2) {
      if (draft.durationMode === 'max_1y') return true
      return !!draft.durationUntil
    }
    return false
  }, [step, draft])

  const canSubmit = useMemo<boolean>(() => {
    if (step !== 3) return false
    if (draft.personName.trim().length < 2) return false
    if (!draft.channel) return false
    if (draft.channel === 'email' && !isValidEmail(draft.personEmail)) return false
    return true
  }, [step, draft])

  const handleSubmit = () => {
    if (!canSubmit) return
    onSubmitted?.(draft)
    onOpenChange(false)
  }

  const handleNext = () => {
    if (step === 1 && canGoNext) setStep(2)
    else if (step === 2 && canGoNext) setStep(3)
  }

  const handlePrev = () => {
    if (step === 2) setStep(1)
    else if (step === 3) setStep(2)
  }

  const handleCancel = () => {
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nouvelle demande d&apos;accès</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 pt-2">
          <Stepper current={step} />

          <div className="rounded-2xl border border-primary/10 bg-card/60 p-4 sm:p-5">
            <h3 className="mb-4 text-base font-semibold text-foreground">
              {STEPS[step - 1].label}
            </h3>
            {step === 1 && <StepScope draft={draft} onChange={setDraft} />}
            {step === 2 && <StepDuration draft={draft} onChange={setDraft} />}
            {step === 3 && <StepSend draft={draft} onChange={setDraft} />}
          </div>

          {/* Boutons */}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Button
              variant="ghost"
              size="lg"
              onClick={handleCancel}
              className="text-muted-foreground hover:text-foreground"
            >
              Annuler la demande
            </Button>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
              {step > 1 && (
                <Button variant="outline" size="lg" onClick={handlePrev}>
                  <ArrowLeft className="size-4" aria-hidden />
                  Précédent
                </Button>
              )}
              {step < 3 && (
                <Button
                  variant="default"
                  size="lg"
                  onClick={handleNext}
                  disabled={!canGoNext}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  Suivant
                  <ArrowRight className="size-4" aria-hidden />
                </Button>
              )}
              {step === 3 && (
                <Button
                  variant="default"
                  size="lg"
                  onClick={handleSubmit}
                  disabled={!canSubmit}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  <Send className="size-4" aria-hidden />
                  Envoyer la demande
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
