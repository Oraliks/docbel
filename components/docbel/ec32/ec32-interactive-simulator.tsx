'use client'

// =====================================================================
//  eC3.2 — Simulateur interactif (cœur pédagogique)
// ---------------------------------------------------------------------
//  Orchestre le flux en 8 étapes (login → send), tout l'état du
//  simulateur (employeur, mois, jours encodés, sélection, corrections,
//  affiliation, jour simulé, envoi), les cas pratiques (presets), la
//  persistance localStorage (SSR-safe) et l'export PDF.
//
//  SIMULATION NON OFFICIELLE : données 100 % fictives, AUCUNE donnée
//  réelle n'est demandée, RIEN n'est jamais transmis à l'ONEM.
// =====================================================================

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  Building2,
  CalendarDays,
  Check,
  Download,
  FastForward,
  Fingerprint,
  ListChecks,
  Lock,
  PencilLine,
  RotateCcw,
  Send,
  Smartphone,
  Globe,
  KeyRound,
} from 'lucide-react'
import type { ComponentType } from 'react'
import { cn } from '@/lib/utils'
import {
  EC32_STEPS,
  type Ec32CardStatus,
  type Ec32CardView,
  type Ec32Correction,
  type Ec32DayCell,
  type Ec32PaymentAffiliationStatus,
  type Ec32SituationType,
  type Ec32StepKey,
} from '@/lib/ec32/types'
import type {
  Ec32Content,
  Ec32EmployerContent,
  Ec32MonthContent,
} from '@/lib/ec32/schema'
import {
  EC32_SCENARIO_PRESETS,
  generateMonthGrid,
  getFirstSendDateLabel,
  getMonthBehavior,
  initialSimulatedDay,
  isSendAllowed,
} from '@/lib/ec32/rules'
import { ec32Label, ec32Notice } from '@/lib/ec32/labels'
import {
  exportEc32SimulationPdf,
  type Ec32PdfRow,
} from '@/lib/ec32/export-pdf'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import {
  Ec32Card,
  Ec32InfoBox,
  Ec32Section,
} from '@/components/docbel/ec32/ui'
import {
  Ec32GuidedSteps,
  type Ec32GuidedStep,
} from '@/components/docbel/ec32/ec32-guided-steps'
import { Ec32Calendar } from '@/components/docbel/ec32/ec32-calendar'
import { Ec32SituationSelector } from '@/components/docbel/ec32/ec32-situation-selector'
import { Ec32CoachPanel } from '@/components/docbel/ec32/ec32-coach-panel'
import {
  Ec32CorrectionModal,
  type Ec32CorrectionModalLabels,
} from '@/components/docbel/ec32/ec32-correction-modal'
import {
  Ec32SendModal,
  type Ec32SendModalLabels,
} from '@/components/docbel/ec32/ec32-send-modal'
import { Ec32ListView } from '@/components/docbel/ec32/ec32-list-view'

// ─────────────────────────── Constantes ───────────────────────────

const STORAGE_KEY = 'docbel-ec32-sim'

const FRENCH_MONTHS_SHORT = [
  'janv.',
  'févr.',
  'mars',
  'avr.',
  'mai',
  'juin',
  'juil.',
  'août',
  'sept.',
  'oct.',
  'nov.',
  'déc.',
] as const

const FRENCH_WEEKDAYS_SHORT = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'] as const

const LOGIN_METHODS: Array<{
  key: 'eid' | 'itsme' | 'frontalier' | 'noMeans'
  icon: ComponentType<{ className?: string }>
}> = [
  { key: 'eid', icon: Fingerprint },
  { key: 'itsme', icon: Smartphone },
  { key: 'frontalier', icon: Globe },
  { key: 'noMeans', icon: KeyRound },
]

const DEFAULT_EMPLOYER_ID = 'emp-a'
const DEFAULT_MONTH_KEY = '2025-05'

// ─────────────────────────── État persisté ───────────────────────────

interface PersistedState {
  employerId: string
  monthKey: string
  affiliated: boolean
  encodings: Record<string, Ec32SituationType>
  corrections: Record<string, Ec32Correction>
}

// ─────────────────────────── Composant principal ───────────────────────────

export function Ec32InteractiveSimulator({
  content,
  scenarioKey,
  onScenarioConsumed,
}: {
  content: Ec32Content
  scenarioKey?: string | null
  onScenarioConsumed?: () => void
}) {
  const sim = content.simulator

  // ── Helpers de libellés / notices (contenu éditable → repli codé) ──
  const getLabel = useCallback(
    (key: string, fallback?: string): string => {
      const fromContent = sim.labels.find((l) => l.key === key)?.text?.trim()
      return fromContent || ec32Label(key) || fallback || key
    },
    [sim.labels],
  )

  const getNotice = useCallback(
    (key: string): string => {
      const fromContent = sim.notices.find((n) => n.key === key)?.text?.trim()
      return fromContent || ec32Notice(key)
    },
    [sim.notices],
  )

  const situationLabel = useCallback(
    (situation: Ec32SituationType): string => {
      const found = sim.situations.find((s) => s.type === situation)
      return found?.shortLabel?.trim() || found?.label?.trim() || situation
    },
    [sim.situations],
  )

  const situationDescription = useCallback(
    (situation: Ec32SituationType): string => {
      const found = sim.situations.find((s) => s.type === situation)
      return found?.description?.trim() || ''
    },
    [sim.situations],
  )

  // ── État de navigation ──
  const [activeStep, setActiveStep] = useState<Ec32StepKey>('login')
  const [maxReachedIndex, setMaxReachedIndex] = useState(0)
  const [revealedLogin, setRevealedLogin] = useState<string | null>(null)
  const [declarationChecked, setDeclarationChecked] = useState(false)
  const [declarationMonth, setDeclarationMonth] = useState<string>(DEFAULT_MONTH_KEY)

  // ── État du dossier (employeur / mois / carte) ──
  const [employerId, setEmployerId] = useState<string>(DEFAULT_EMPLOYER_ID)
  const [monthKey, setMonthKey] = useState<string>(DEFAULT_MONTH_KEY)
  const [affiliated, setAffiliated] = useState(true)

  // Encodages persistés par date (situation choisie) + corrections.
  const [encodings, setEncodings] = useState<Record<string, Ec32SituationType>>({})
  const [corrections, setCorrections] = useState<Record<string, Ec32Correction>>({})

  // ── État d'interaction ──
  const [cardView, setCardView] = useState<Ec32CardView>('calendar')
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set())
  const [selectorSituation, setSelectorSituation] =
    useState<Ec32SituationType>('temporary_unemployment')
  const [selectorOpen, setSelectorOpen] = useState(false)

  const [cardStatus, setCardStatus] = useState<Ec32CardStatus>('draft')
  const [simulatedDay, setSimulatedDay] = useState(1)

  const [correctionDate, setCorrectionDate] = useState<string | null>(null)
  const [sendOpen, setSendOpen] = useState(false)
  const [showUnsaved, setShowUnsaved] = useState(false)

  const [suggestedSituation, setSuggestedSituation] =
    useState<Ec32SituationType | null>(null)
  const [scenarioHint, setScenarioHint] = useState<string | null>(null)
  const [hydrated, setHydrated] = useState(false)

  // ── Données dérivées du mois ──
  const behavior = useMemo(() => getMonthBehavior(monthKey), [monthKey])

  const employer: Ec32EmployerContent | undefined = useMemo(
    () => sim.employers.find((e) => e.id === employerId),
    [sim.employers, employerId],
  )

  const monthContent: Ec32MonthContent | undefined = useMemo(
    () => sim.months.find((m) => m.key === monthKey),
    [sim.months, monthKey],
  )

  const monthLabel = monthContent?.label?.trim() || monthKey

  // Grille calendrier : base générée + encodages/corrections appliqués.
  const cells: Ec32DayCell[] = useMemo(() => {
    if (!behavior) return []
    const base = generateMonthGrid(behavior)
    return base.map((cell) => {
      if (!cell.selectable) return cell
      const encoded = encodings[cell.date]
      const correction = corrections[cell.date] ?? null
      return {
        ...cell,
        situation: encoded ?? cell.situation,
        correction,
      }
    })
  }, [behavior, encodings, corrections])

  const isLocked = cardStatus === 'sent' || cardStatus === 'locked'

  const firstSendLabel = useMemo(
    () => (behavior ? getFirstSendDateLabel(behavior, monthLabel) : ''),
    [behavior, monthLabel],
  )

  const sendAllowed = useMemo(
    () => (behavior ? isSendAllowed(behavior, simulatedDay) : false),
    [behavior, simulatedDay],
  )

  // ── Format de date lisible (déterministe, à partir de l'ISO) ──
  const formatDate = useCallback((iso: string): string => {
    const [y, m, d] = iso.split('-').map((n) => Number.parseInt(n, 10))
    if (!y || !m || !d) return iso
    const weekday = new Date(y, m - 1, d).getDay()
    return `${FRENCH_WEEKDAYS_SHORT[weekday]} ${d} ${FRENCH_MONTHS_SHORT[m - 1]} ${y}`
  }, [])

  // ── Réinitialise le statut/jour simulé quand le mois change ──
  const resetMonthRuntime = useCallback((nextMonthKey: string) => {
    const b = getMonthBehavior(nextMonthKey)
    if (!b) return
    setCardStatus(b.status)
    setSimulatedDay(initialSimulatedDay(b))
  }, [])

  // ─────────────── Persistance localStorage (SSR-safe) ───────────────

  // Restauration au montage (avant l'application d'un éventuel scénario).
  useEffect(() => {
    if (typeof window === 'undefined') {
      setHydrated(true)
      return
    }
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<PersistedState>
        if (parsed.employerId) setEmployerId(parsed.employerId)
        if (parsed.monthKey) {
          setMonthKey(parsed.monthKey)
          setDeclarationMonth(parsed.monthKey)
          resetMonthRuntime(parsed.monthKey)
        }
        if (typeof parsed.affiliated === 'boolean') setAffiliated(parsed.affiliated)
        if (parsed.encodings) setEncodings(parsed.encodings)
        if (parsed.corrections) setCorrections(parsed.corrections)
      } else {
        resetMonthRuntime(DEFAULT_MONTH_KEY)
      }
    } catch {
      resetMonthRuntime(DEFAULT_MONTH_KEY)
    }
    setHydrated(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Sauvegarde à chaque changement significatif (après hydratation).
  useEffect(() => {
    if (!hydrated || typeof window === 'undefined') return
    const payload: PersistedState = {
      employerId,
      monthKey,
      affiliated,
      encodings,
      corrections,
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
    } catch {
      // Stockage indisponible (mode privé) : on ignore silencieusement.
    }
  }, [hydrated, employerId, monthKey, affiliated, encodings, corrections])

  // ─────────────── Cas pratiques (presets) ───────────────

  useEffect(() => {
    if (!scenarioKey) return
    const preset = EC32_SCENARIO_PRESETS[scenarioKey]
    if (!preset) {
      onScenarioConsumed?.()
      return
    }

    if (preset.employerId) setEmployerId(preset.employerId)
    if (preset.monthKey) {
      setMonthKey(preset.monthKey)
      setDeclarationMonth(preset.monthKey)
      resetMonthRuntime(preset.monthKey)
    }
    if (preset.paymentAffiliation) {
      setAffiliated(preset.paymentAffiliation === 'affiliated')
    }
    setSuggestedSituation(preset.suggestedSituation ?? null)
    if (preset.suggestedSituation) setSelectorSituation(preset.suggestedSituation)
    setScenarioHint(preset.hint ?? null)

    if (preset.targetDays && preset.targetDays.length > 0 && preset.monthKey) {
      const next = new Set<string>()
      for (const day of preset.targetDays) {
        next.add(`${preset.monthKey}-${pad2(day)}`)
      }
      setSelectedDates(next)
      setSelectorOpen(true)
    } else {
      setSelectedDates(new Set())
    }

    goToStep(preset.step, true)
    setDeclarationChecked(true)

    onScenarioConsumed?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenarioKey])

  // ─────────────── Navigation ───────────────

  const stepIndex = (key: Ec32StepKey): number => EC32_STEPS.indexOf(key)

  const goToStep = useCallback(
    (key: Ec32StepKey, silent = false): void => {
      const idx = stepIndex(key)
      // Avertit si des jours sélectionnés n'ont pas été enregistrés.
      if (!silent && selectedDates.size > 0 && selectorOpen) {
        setShowUnsaved(true)
      } else {
        setShowUnsaved(false)
      }
      setActiveStep(key)
      setMaxReachedIndex((prev) => Math.max(prev, idx))
    },
    [selectedDates.size, selectorOpen],
  )

  const guidedSteps: Ec32GuidedStep[] = useMemo(
    () =>
      EC32_STEPS.map((key) => {
        const found = sim.steps.find((s) => s.key === key)
        return { key, title: found?.title?.trim() || ec32Label(`${key}.title`) }
      }),
    [sim.steps],
  )

  // ─────────────── Sélection de jours ───────────────

  const toggleDay = useCallback(
    (date: string): void => {
      if (isLocked) return
      setSelectedDates((prev) => {
        const next = new Set(prev)
        if (next.has(date)) next.delete(date)
        else next.add(date)
        setSelectorOpen(next.size > 0)
        return next
      })
      setShowUnsaved(false)
    },
    [isLocked],
  )

  const clearSelection = useCallback(() => {
    setSelectedDates(new Set())
    setSelectorOpen(false)
    setShowUnsaved(false)
  }, [])

  const applySituationToSelection = useCallback(() => {
    if (selectedDates.size === 0) return
    setEncodings((prev) => {
      const next = { ...prev }
      for (const date of selectedDates) {
        next[date] = selectorSituation
      }
      return next
    })
    clearSelection()
  }, [selectedDates, selectorSituation, clearSelection])

  // ─────────────── Correction ───────────────

  const openCorrection = useCallback((date: string) => {
    setCorrectionDate(date)
  }, [])

  const saveCorrection = useCallback(
    (to: Ec32SituationType, reason: string) => {
      if (!correctionDate) return
      const fromSituation =
        encodings[correctionDate] ??
        cells.find((c) => c.date === correctionDate)?.situation ??
        'temporary_unemployment'
      setEncodings((prev) => ({ ...prev, [correctionDate]: to }))
      setCorrections((prev) => ({
        ...prev,
        [correctionDate]: {
          date: correctionDate,
          from: fromSituation,
          to,
          reason,
        },
      }))
      setCorrectionDate(null)
    },
    [correctionDate, encodings, cells],
  )

  const correctionCurrentSituation: Ec32SituationType = useMemo(() => {
    if (!correctionDate) return 'temporary_unemployment'
    return (
      encodings[correctionDate] ??
      cells.find((c) => c.date === correctionDate)?.situation ??
      'temporary_unemployment'
    )
  }, [correctionDate, encodings, cells])

  // ─────────────── Envoi ───────────────

  const confirmSend = useCallback(() => {
    if (!affiliated) return
    setCardStatus('locked')
  }, [affiliated])

  const advanceToFirstSendDay = useCallback(() => {
    if (behavior) setSimulatedDay(behavior.firstSendDay)
  }, [behavior])

  // ─────────────── Export PDF ───────────────

  const handleExportPdf = useCallback(async () => {
    const rows: Ec32PdfRow[] = cells
      .filter((c) => c.inMonth)
      .map((c) => ({
        date: formatDate(c.date),
        situationLabel: situationLabel(c.situation),
        note: c.correction ? `Correction : ${c.correction.reason}` : undefined,
      }))

    await exportEc32SimulationPdf({
      docTitle: sim.pdf.docTitle || 'Aperçu pédagogique eC3.2 — simulation',
      fictionMention:
        sim.pdf.fictionMention ||
        'Document fictif — ne remplace pas une carte officielle.',
      warning: sim.pdf.warning || 'Ce document n’est pas une carte officielle.',
      monthLabel,
      employerName: employer?.name || '—',
      enterpriseNumber: employer?.enterpriseNumber || '—',
      rows,
    })
  }, [cells, formatDate, situationLabel, sim.pdf, monthLabel, employer])

  // ─────────────── Réinitialisation complète ───────────────

  const restart = useCallback(() => {
    setActiveStep('login')
    setMaxReachedIndex(0)
    setRevealedLogin(null)
    setDeclarationChecked(false)
    setDeclarationMonth(DEFAULT_MONTH_KEY)
    setEmployerId(DEFAULT_EMPLOYER_ID)
    setMonthKey(DEFAULT_MONTH_KEY)
    setAffiliated(true)
    setEncodings({})
    setCorrections({})
    setCardView('calendar')
    clearSelection()
    setSelectorSituation('temporary_unemployment')
    setSuggestedSituation(null)
    setScenarioHint(null)
    setSendOpen(false)
    setCorrectionDate(null)
    resetMonthRuntime(DEFAULT_MONTH_KEY)
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.removeItem(STORAGE_KEY)
      } catch {
        // ignore
      }
    }
  }, [clearSelection, resetMonthRuntime])

  // ─────────────── Sélection employeur / mois ───────────────

  const selectEmployer = useCallback((id: string) => {
    setEmployerId(id)
  }, [])

  const selectMonth = useCallback(
    (key: string) => {
      const b = getMonthBehavior(key)
      if (!b) return
      setMonthKey(key)
      resetMonthRuntime(key)
      clearSelection()
    },
    [resetMonthRuntime, clearSelection],
  )

  // ─────────────── Étiquettes des modales ───────────────

  const correctionLabels: Ec32CorrectionModalLabels = {
    title: sim.correctionModal.title || ec32Label('card.corrections'),
    helpText: sim.correctionModal.helpText || getNotice('correction.help'),
    dayLabel: sim.correctionModal.dayLabel || 'Jour concerné',
    fromLabel: sim.correctionModal.fromLabel || 'Ancienne situation',
    toLabel: sim.correctionModal.toLabel || 'Nouvelle situation',
    reasonLabel: sim.correctionModal.reasonLabel || 'Explication (obligatoire)',
    reasonPlaceholder: sim.correctionModal.reasonPlaceholder || 'Expliquez la correction…',
    saveLabel: sim.correctionModal.saveLabel || 'Sauvegarder la correction',
    lockedMessage: sim.correctionModal.lockedMessage || getNotice('correction.locked'),
    requiredError:
      sim.correctionModal.requiredError ||
      'L’explication est obligatoire pour enregistrer une correction.',
  }

  const sendLabels: Ec32SendModalLabels = {
    title: sim.sendModal.title || ec32Label('card.send'),
    body: sim.sendModal.body || '',
    cancelLabel: sim.sendModal.cancelLabel || 'Annuler',
    confirmLabel: sim.sendModal.confirmLabel || 'Confirmer l’envoi simulé',
    successTitle: sim.sendModal.successTitle || 'Carte envoyée — simulation',
    successBody: sim.sendModal.successBody || '',
    blockedTitle: sim.sendModal.blockedTitle || 'Envoi impossible — simulation',
    blockedBody: sim.sendModal.blockedBody || getNotice('send.noPaymentOrg'),
  }

  // ─────────────── Rendu ───────────────

  return (
    <Ec32Section
      id="simulateur"
      eyebrow="Simulateur"
      title={sim.title}
      subtitle={sim.subtitle}
      icon={CalendarDays}
    >
      {/* Stepper */}
      <div className="mb-5">
        <Ec32GuidedSteps
          steps={guidedSteps}
          activeStep={activeStep}
          maxReachedIndex={maxReachedIndex}
          onSelectStep={(key) => goToStep(key)}
        />
      </div>

      {/* Avertissement fictif global */}
      {sim.fictitiousDataNotice && (
        <Ec32InfoBox tone="legal" icon={AlertTriangle} className="mb-5">
          {sim.fictitiousDataNotice}
        </Ec32InfoBox>
      )}

      {showUnsaved && (
        <Ec32InfoBox tone="warning" className="mb-5" title="Modifications non enregistrées">
          {getNotice('save.unsaved')}
        </Ec32InfoBox>
      )}

      {/* Grille : contenu + coach (coach passe dessous en mobile) */}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-5">
          {activeStep === 'login' && (
            <StepLogin
              getLabel={getLabel}
              getNotice={getNotice}
              revealed={revealedLogin}
              onReveal={setRevealedLogin}
              onContinue={() => goToStep('declaration')}
            />
          )}

          {activeStep === 'declaration' && (
            <StepDeclaration
              getLabel={getLabel}
              getNotice={getNotice}
              months={sim.months}
              month={declarationMonth}
              checked={declarationChecked}
              onMonthChange={(k) => {
                setDeclarationMonth(k)
                selectMonth(k)
              }}
              onCheckedChange={setDeclarationChecked}
              onContinue={() => goToStep('employer')}
            />
          )}

          {activeStep === 'employer' && (
            <StepEmployer
              getLabel={getLabel}
              getNotice={getNotice}
              employers={sim.employers}
              employerId={employerId}
              onSelect={selectEmployer}
              onContinue={() => goToStep('month')}
            />
          )}

          {activeStep === 'month' && (
            <StepMonth
              getLabel={getLabel}
              getNotice={getNotice}
              months={sim.months}
              monthKey={monthKey}
              onSelect={(k) => {
                selectMonth(k)
              }}
              onContinue={() => goToStep('calendar')}
            />
          )}

          {(activeStep === 'calendar' ||
            activeStep === 'correction' ||
            activeStep === 'verify' ||
            activeStep === 'send') && (
            <CardWorkspace
              activeStep={activeStep}
              content={content}
              getLabel={getLabel}
              getNotice={getNotice}
              employer={employer}
              monthLabel={monthLabel}
              cells={cells}
              cardView={cardView}
              onCardView={setCardView}
              selectedDates={selectedDates}
              selectorOpen={selectorOpen}
              selectorSituation={selectorSituation}
              suggestedSituation={suggestedSituation}
              situationLabel={situationLabel}
              situationDescription={situationDescription}
              isLocked={isLocked}
              cardStatus={cardStatus}
              affiliated={affiliated}
              firstSendLabel={firstSendLabel}
              sendAllowed={sendAllowed}
              formatDate={formatDate}
              onToggleDay={toggleDay}
              onClearSelection={clearSelection}
              onSelectorSituation={setSelectorSituation}
              onApplySituation={applySituationToSelection}
              onOpenSelector={() => setSelectorOpen(true)}
              onAffiliationChange={setAffiliated}
              onAdvanceToSend={advanceToFirstSendDay}
              onExportPdf={handleExportPdf}
              onOpenSend={() => setSendOpen(true)}
              onEditDay={openCorrection}
            />
          )}

          {/* Navigation bas + reset */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
            <Button type="button" variant="ghost" size="sm" onClick={restart}>
              <RotateCcw className="size-3.5" aria-hidden />
              {getLabel('nav.restart')}
            </Button>
            <StepNavButtons
              activeStep={activeStep}
              getLabel={getLabel}
              onPrev={() => {
                const idx = stepIndex(activeStep)
                if (idx > 0) goToStep(EC32_STEPS[idx - 1])
              }}
              onNext={() => {
                const idx = stepIndex(activeStep)
                if (idx < EC32_STEPS.length - 1) goToStep(EC32_STEPS[idx + 1])
              }}
            />
          </div>
        </div>

        {/* Coach */}
        <Ec32CoachPanel
          title={sim.coach.title}
          intro={sim.coach.intro}
          tips={sim.coach.tips}
          activeStep={activeStep}
          scenarioHint={scenarioHint}
        />
      </div>

      {/* Modales */}
      <Ec32CorrectionModal
        open={correctionDate !== null}
        locked={isLocked}
        dayLabel={correctionDate ? formatDate(correctionDate) : ''}
        currentSituation={correctionCurrentSituation}
        labels={correctionLabels}
        situationLabel={situationLabel}
        onOpenChange={(o) => {
          if (!o) setCorrectionDate(null)
        }}
        onSave={saveCorrection}
      />

      <Ec32SendModal
        open={sendOpen}
        affiliated={affiliated}
        labels={sendLabels}
        onOpenChange={setSendOpen}
        onConfirm={confirmSend}
      />
    </Ec32Section>
  )
}

// ═════════════════════════ Sous-composants d'étape ═════════════════════════

function StepNavButtons({
  activeStep,
  getLabel,
  onPrev,
  onNext,
}: {
  activeStep: Ec32StepKey
  getLabel: (key: string, fallback?: string) => string
  onPrev: () => void
  onNext: () => void
}) {
  const idx = EC32_STEPS.indexOf(activeStep)
  return (
    <div className="flex gap-2">
      <Button type="button" variant="outline" size="sm" onClick={onPrev} disabled={idx <= 0}>
        {getLabel('nav.back')}
      </Button>
      <Button
        type="button"
        size="sm"
        onClick={onNext}
        disabled={idx >= EC32_STEPS.length - 1}
      >
        {getLabel('nav.next')}
      </Button>
    </div>
  )
}

function StepLogin({
  getLabel,
  getNotice,
  revealed,
  onReveal,
  onContinue,
}: {
  getLabel: (key: string, fallback?: string) => string
  getNotice: (key: string) => string
  revealed: string | null
  onReveal: (key: string) => void
  onContinue: () => void
}) {
  return (
    <Ec32Card>
      <h3 className="text-lg font-bold text-foreground">{getLabel('login.title')}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{getLabel('login.intro')}</p>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {LOGIN_METHODS.map(({ key, icon: Icon }) => {
          const isOpen = revealed === key
          return (
            <button
              key={key}
              type="button"
              onClick={() => onReveal(key)}
              aria-expanded={isOpen}
              className={cn(
                'flex items-center gap-2 rounded-2xl border p-3 text-left text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                isOpen
                  ? 'border-primary bg-primary/5 text-foreground'
                  : 'border-border bg-card/60 text-foreground hover:bg-primary/5',
              )}
            >
              <Icon className="size-4 shrink-0 text-primary" aria-hidden />
              {getLabel(`login.${key}`)}
            </button>
          )
        })}
      </div>

      {revealed && (
        <Ec32InfoBox tone="info" className="mt-4">
          {getNotice(`login.${revealed}`)}
        </Ec32InfoBox>
      )}

      <div className="mt-5">
        <Button type="button" onClick={onContinue}>
          {getLabel('login.continue')}
        </Button>
      </div>
    </Ec32Card>
  )
}

function StepDeclaration({
  getLabel,
  getNotice,
  months,
  month,
  checked,
  onMonthChange,
  onCheckedChange,
  onContinue,
}: {
  getLabel: (key: string, fallback?: string) => string
  getNotice: (key: string) => string
  months: Ec32MonthContent[]
  month: string
  checked: boolean
  onMonthChange: (key: string) => void
  onCheckedChange: (v: boolean) => void
  onContinue: () => void
}) {
  return (
    <Ec32Card>
      <h3 className="text-lg font-bold text-foreground">{getLabel('declaration.title')}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{getLabel('declaration.intro')}</p>

      <div className="mt-4 max-w-sm space-y-1.5">
        <Label htmlFor="ec32-decl-month">{getLabel('declaration.monthField')}</Label>
        <Select value={month} onValueChange={(v) => v && onMonthChange(v)}>
          <SelectTrigger id="ec32-decl-month" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {months.map((m) => (
              <SelectItem key={m.key} value={m.key}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Ec32InfoBox tone="info" className="mt-4">
        {getNotice('declaration.monthImportance')}
      </Ec32InfoBox>

      <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-2xl border border-border bg-card/60 p-3">
        <Checkbox
          checked={checked}
          onCheckedChange={(v) => onCheckedChange(v === true)}
          aria-label={getLabel('declaration.checkbox')}
          className="mt-0.5"
        />
        <span className="text-sm leading-relaxed text-foreground">
          {getLabel('declaration.checkbox')}
        </span>
      </label>

      <div className="mt-5">
        <Button type="button" onClick={onContinue} disabled={!checked}>
          {getLabel('declaration.continue')}
        </Button>
      </div>
    </Ec32Card>
  )
}

function StepEmployer({
  getLabel,
  getNotice,
  employers,
  employerId,
  onSelect,
  onContinue,
}: {
  getLabel: (key: string, fallback?: string) => string
  getNotice: (key: string) => string
  employers: Ec32EmployerContent[]
  employerId: string
  onSelect: (id: string) => void
  onContinue: () => void
}) {
  const selected = employers.find((e) => e.id === employerId)
  const isConstruction = selected?.type === 'construction_cp124'

  return (
    <Ec32Card>
      <h3 className="text-lg font-bold text-foreground">{getLabel('employer.title')}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{getLabel('employer.intro')}</p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {employers.map((emp) => {
          const isActive = emp.id === employerId
          return (
            <button
              key={emp.id}
              type="button"
              onClick={() => onSelect(emp.id)}
              aria-pressed={isActive}
              className={cn(
                'flex flex-col gap-1 rounded-2xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                isActive
                  ? 'border-primary bg-primary/5 ring-1 ring-primary/40'
                  : 'border-border bg-card/60 hover:bg-primary/5',
              )}
            >
              <span className="flex items-center gap-2">
                <Building2 className="size-4 text-primary" aria-hidden />
                <span className="font-semibold text-foreground">{emp.name}</span>
                {isActive && <Check className="ml-auto size-4 text-primary" aria-hidden />}
              </span>
              <span className="text-xs text-muted-foreground">{emp.sector}</span>
              <span className="text-xs text-muted-foreground">
                {getLabel('employer.enterprise')} : {emp.enterpriseNumber}
              </span>
            </button>
          )
        })}
      </div>

      <Ec32InfoBox tone="neutral" className="mt-4" title="Combien d’employeurs ?">
        <ul className="list-disc space-y-1 pl-4">
          <li>1 employeur : une seule carte à compléter pour cet employeur.</li>
          <li>
            2 employeurs : choisissez celui qui vous a mis en chômage temporaire ; vos autres
            occupations s’indiquent sur cette carte.
          </li>
          <li>3 employeurs ou plus : une carte par employeur ayant déclaré du chômage temporaire.</li>
        </ul>
      </Ec32InfoBox>

      {isConstruction && (
        <Ec32InfoBox tone="warning" className="mt-3" title="Secteur construction (CP 124)">
          {getNotice('calendar.fillUntilEnd')}
        </Ec32InfoBox>
      )}

      <div className="mt-5">
        <Button type="button" onClick={onContinue} disabled={!selected}>
          {getLabel('employer.continue')}
        </Button>
      </div>
    </Ec32Card>
  )
}

function StepMonth({
  getLabel,
  getNotice,
  months,
  monthKey,
  onSelect,
  onContinue,
}: {
  getLabel: (key: string, fallback?: string) => string
  getNotice: (key: string) => string
  months: Ec32MonthContent[]
  monthKey: string
  onSelect: (key: string) => void
  onContinue: () => void
}) {
  const [pastActivated, setPastActivated] = useState(false)

  return (
    <Ec32Card>
      <h3 className="text-lg font-bold text-foreground">{getLabel('month.title')}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{getLabel('month.intro')}</p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {months.map((m) => {
          const b = getMonthBehavior(m.key)
          const locked = b?.status === 'sent' || b?.status === 'locked'
          const isActive = m.key === monthKey
          return (
            <button
              key={m.key}
              type="button"
              onClick={() => !locked && onSelect(m.key)}
              disabled={locked}
              aria-pressed={isActive}
              className={cn(
                'flex flex-col gap-1 rounded-2xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                locked
                  ? 'cursor-not-allowed border-border/60 bg-muted/30 text-muted-foreground'
                  : isActive
                    ? 'border-primary bg-primary/5 ring-1 ring-primary/40'
                    : 'border-border bg-card/60 hover:bg-primary/5',
              )}
            >
              <span className="flex items-center gap-2">
                {locked ? (
                  <Lock className="size-4 text-muted-foreground" aria-hidden />
                ) : (
                  <CalendarDays className="size-4 text-primary" aria-hidden />
                )}
                <span className="font-semibold">{m.label}</span>
                {isActive && !locked && (
                  <Check className="ml-auto size-4 text-primary" aria-hidden />
                )}
              </span>
              <span className="text-xs text-muted-foreground">
                {locked ? getLabel('month.locked') : m.statusNote}
              </span>
            </button>
          )
        })}
      </div>

      <Ec32InfoBox tone="info" className="mt-4">
        {getNotice('month.cards')}
      </Ec32InfoBox>

      <div className="mt-4">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setPastActivated(true)}
        >
          {getLabel('month.activatePast')}
        </Button>
        {pastActivated && (
          <Ec32InfoBox tone="neutral" className="mt-3">
            {getNotice('month.activatePast')}
          </Ec32InfoBox>
        )}
      </div>

      <div className="mt-5">
        <Button type="button" onClick={onContinue}>
          {getLabel('nav.toCalendar')}
        </Button>
      </div>
    </Ec32Card>
  )
}

// ═════════════════════════ Espace carte (calendar/correction/verify/send) ═════════════════════════

function CardWorkspace({
  activeStep,
  content,
  getLabel,
  getNotice,
  employer,
  monthLabel,
  cells,
  cardView,
  onCardView,
  selectedDates,
  selectorOpen,
  selectorSituation,
  suggestedSituation,
  situationLabel,
  situationDescription,
  isLocked,
  cardStatus,
  affiliated,
  firstSendLabel,
  sendAllowed,
  formatDate,
  onToggleDay,
  onClearSelection,
  onSelectorSituation,
  onApplySituation,
  onOpenSelector,
  onAffiliationChange,
  onAdvanceToSend,
  onExportPdf,
  onOpenSend,
  onEditDay,
}: {
  activeStep: Ec32StepKey
  content: Ec32Content
  getLabel: (key: string, fallback?: string) => string
  getNotice: (key: string) => string
  employer: Ec32EmployerContent | undefined
  monthLabel: string
  cells: Ec32DayCell[]
  cardView: Ec32CardView
  onCardView: (v: Ec32CardView) => void
  selectedDates: Set<string>
  selectorOpen: boolean
  selectorSituation: Ec32SituationType
  suggestedSituation: Ec32SituationType | null
  situationLabel: (s: Ec32SituationType) => string
  situationDescription: (s: Ec32SituationType) => string
  isLocked: boolean
  cardStatus: Ec32CardStatus
  affiliated: boolean
  firstSendLabel: string
  sendAllowed: boolean
  formatDate: (iso: string) => string
  onToggleDay: (date: string) => void
  onClearSelection: () => void
  onSelectorSituation: (s: Ec32SituationType) => void
  onApplySituation: () => void
  onOpenSelector: () => void
  onAffiliationChange: (v: boolean) => void
  onAdvanceToSend: () => void
  onExportPdf: () => void
  onOpenSend: () => void
  onEditDay: (date: string) => void
}) {
  const selectedCount = selectedDates.size

  return (
    <Ec32Card>
      {/* En-tête de carte fictive */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-bold text-foreground">
            {getLabel('card.title')}
            {isLocked && (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                <Lock className="size-3" aria-hidden />
                {getLabel('month.locked')}
              </span>
            )}
          </h3>
          <dl className="mt-1.5 grid gap-0.5 text-xs text-muted-foreground sm:grid-cols-2">
            <div>
              <dt className="inline font-medium text-foreground">{getLabel('card.employer')} : </dt>
              <dd className="inline">{employer?.name ?? '—'}</dd>
            </div>
            <div>
              <dt className="inline font-medium text-foreground">{getLabel('card.enterprise')} : </dt>
              <dd className="inline">{employer?.enterpriseNumber ?? '—'}</dd>
            </div>
            <div>
              <dt className="inline font-medium text-foreground">Mois : </dt>
              <dd className="inline">{monthLabel}</dd>
            </div>
            <div>
              <dt className="inline font-medium text-foreground">{getLabel('card.lastUpdate')} : </dt>
              <dd className="inline">simulation — {formatDate(cells.find((c) => c.inMonth)?.date ?? '2025-05-01')}</dd>
            </div>
          </dl>
        </div>

        {/* Bascule vue calendrier / liste */}
        <div className="inline-flex rounded-full border border-border p-0.5">
          <button
            type="button"
            onClick={() => onCardView('calendar')}
            aria-pressed={cardView === 'calendar'}
            className={cn(
              'rounded-full px-3 py-1 text-xs font-medium transition-colors',
              cardView === 'calendar'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {getLabel('card.calendarView')}
          </button>
          <button
            type="button"
            onClick={() => onCardView('list')}
            aria-pressed={cardView === 'list'}
            className={cn(
              'rounded-full px-3 py-1 text-xs font-medium transition-colors',
              cardView === 'list'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {getLabel('card.listView')}
          </button>
        </div>
      </div>

      <p className="mt-3 text-xs italic text-muted-foreground">
        {content.simulator.fictitiousDataNotice}
      </p>

      {/* Notice par défaut chômage (étape calendrier) */}
      {activeStep === 'calendar' && (
        <Ec32InfoBox tone="info" className="mt-3">
          {getNotice('calendar.defaultChomage')}
        </Ec32InfoBox>
      )}

      {activeStep === 'verify' && (
        <Ec32InfoBox tone="neutral" className="mt-3" icon={ListChecks} title={getLabel('verify.title')}>
          {getLabel('verify.intro')}
        </Ec32InfoBox>
      )}

      {activeStep === 'correction' && (
        <Ec32InfoBox tone="info" className="mt-3" icon={PencilLine}>
          {getNotice('correction.help')}
        </Ec32InfoBox>
      )}

      {/* Corps : calendrier ou liste */}
      <div className="mt-4">
        {cardView === 'calendar' ? (
          <Ec32Calendar
            cells={cells}
            selectedDates={selectedDates}
            situationLabel={situationLabel}
            legendTitle={getLabel('calendar.legend')}
            calendarTabLabel={getLabel('card.calendarTab')}
            legendTabLabel={getLabel('card.legendTab')}
            selectHint={getLabel('calendar.selectHint')}
            disabled={isLocked}
            onToggleDay={onToggleDay}
          />
        ) : (
          <Ec32ListView
            cells={cells}
            locked={isLocked}
            labels={{
              date: getLabel('list.date'),
              situation: getLabel('list.situation'),
              correction: getLabel('list.correction'),
              edit: getLabel('list.edit'),
              empty: getLabel('list.empty'),
            }}
            formatDate={formatDate}
            situationLabel={situationLabel}
            onEdit={onEditDay}
          />
        )}
      </div>

      {/* Sélecteur de situation pour jours sélectionnés */}
      {cardView === 'calendar' && !isLocked && (selectorOpen || selectedCount > 0) && (
        <div className="mt-4 rounded-2xl border border-primary/30 bg-primary/[0.03] p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h4 className="text-sm font-semibold text-foreground">
              {getLabel('card.adapt')}
            </h4>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              {selectedCount} {getLabel('selector.selected')}
            </span>
          </div>
          <Ec32SituationSelector
            selectedCount={selectedCount}
            value={selectorSituation}
            groupLabel={getLabel('selector.workElsewhereGroup')}
            saveLabel={selectedCount > 1 ? getLabel('selector.saveMulti') : getLabel('selector.save')}
            cancelLabel={getLabel('selector.cancel')}
            suggestedSituation={suggestedSituation}
            situationLabel={situationLabel}
            situationDescription={situationDescription}
            onChange={onSelectorSituation}
            onSave={onApplySituation}
            onCancel={onClearSelection}
          />
        </div>
      )}

      {/* Affiliation organisme de paiement */}
      <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-border bg-card/60 p-3">
        <Label htmlFor="ec32-affiliation" className="text-sm text-foreground">
          {getLabel('card.affiliation')}
        </Label>
        <Switch
          id="ec32-affiliation"
          checked={affiliated}
          onCheckedChange={onAffiliationChange}
          disabled={isLocked}
          aria-label={getLabel('card.affiliation')}
        />
      </div>

      {/* Première date d'envoi */}
      <div className="mt-4 rounded-2xl border border-border bg-muted/30 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {getLabel('card.firstSend')}
        </p>
        <p className="mt-0.5 text-sm font-medium text-foreground">{firstSendLabel}</p>
        {!sendAllowed && !isLocked && (
          <>
            <Ec32InfoBox tone="warning" className="mt-3">
              {getNotice('send.firstSendBefore')}
            </Ec32InfoBox>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={onAdvanceToSend}
            >
              <FastForward className="size-3.5" aria-hidden />
              Avancer jusqu’à la première date d’envoi (simulation)
            </Button>
          </>
        )}
      </div>

      {/* Actions */}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={onExportPdf}>
          <Download className="size-4" aria-hidden />
          {getLabel('card.download')}
        </Button>
        {!isLocked && (
          <Button
            type="button"
            onClick={onOpenSend}
            disabled={!sendAllowed}
            aria-disabled={!sendAllowed}
          >
            <Send className="size-4" aria-hidden />
            {getLabel('card.send')}
          </Button>
        )}
        {isLocked && (
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
            <Check className="size-4" aria-hidden />
            Carte envoyée — simulation
          </span>
        )}
      </div>
    </Ec32Card>
  )
}

// ─────────────────────────── util ───────────────────────────

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}
