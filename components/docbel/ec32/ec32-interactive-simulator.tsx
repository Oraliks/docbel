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
  ShieldCheck,
  Smartphone,
  Globe,
  KeyRound,
} from 'lucide-react'
import type { ComponentType, ReactNode } from 'react'
import { cn } from '@/lib/utils'
import {
  EC32_STEPS,
  EC32_WORK_ELSEWHERE_EXCLUSIVE,
  type Ec32CardStatus,
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
import {
  Ec32CorrectionModal,
  type Ec32CorrectionModalLabels,
} from '@/components/docbel/ec32/ec32-correction-modal'
import {
  Ec32SendModal,
  type Ec32SendModalLabels,
} from '@/components/docbel/ec32/ec32-send-modal'
import { Ec32OAuthConsent } from '@/components/docbel/ec32/auth/ec32-oauth-consent'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

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

const CALENDAR_STEP_INDEX = EC32_STEPS.indexOf('calendar')

// ─────────────────────────── État persisté ───────────────────────────

interface PersistedState {
  employerId: string
  monthKey: string
  affiliated: boolean
  encodings: Record<string, Ec32SituationType>
  /** Axe secondaire « travail ailleurs » par date (sous-ensemble ■/▲/👥). */
  secondaryWork: Record<string, Ec32SituationType[]>
  corrections: Record<string, Ec32Correction>
}

// ─────────────────────────── Composant principal ───────────────────────────

export function Ec32InteractiveSimulator({
  content,
  scenarioKey,
  onScenarioConsumed,
  startLoginSignal,
}: {
  content: Ec32Content
  scenarioKey?: string | null
  onScenarioConsumed?: () => void
  /** Incrémenté par « Mode guidé pas à pas » pour démarrer à l'étape connexion. */
  startLoginSignal?: number
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

  // Encodages persistés par date (situation principale) + axe secondaire
  // « travail ailleurs » (sous-ensemble des 3 cases ■/▲/👥) + corrections.
  const [encodings, setEncodings] = useState<Record<string, Ec32SituationType>>({})
  const [secondaryWork, setSecondaryWork] = useState<
    Record<string, Ec32SituationType[]>
  >({})
  const [corrections, setCorrections] = useState<Record<string, Ec32Correction>>({})

  // ── État d'interaction ──
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set())
  const [selectorSituation, setSelectorSituation] =
    useState<Ec32SituationType>('temporary_unemployment')
  // Axe secondaire en cours de choix dans le rail (avant enregistrement) :
  // sous-ensemble des 3 cases ■/▲/👥. ■ et ▲ sont mutuellement exclusives.
  const [selectorSecondaryWork, setSelectorSecondaryWork] = useState<
    Ec32SituationType[]
  >([])
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
        secondaryWork: secondaryWork[cell.date] ?? [],
        correction,
      }
    })
  }, [behavior, encodings, secondaryWork, corrections])

  const isLocked = cardStatus === 'sent' || cardStatus === 'locked'

  // Étapes « application » (carte / calendrier) : on bascule en layout 2 colonnes
  // avec un rail contextuel (coach, légende, jour sélectionné, contrôles).
  const isAppStep =
    activeStep === 'calendar' ||
    activeStep === 'correction' ||
    activeStep === 'verify' ||
    activeStep === 'send'

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
        if (parsed.secondaryWork) setSecondaryWork(parsed.secondaryWork)
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
      secondaryWork,
      corrections,
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
    } catch {
      // Stockage indisponible (mode privé) : on ignore silencieusement.
    }
  }, [hydrated, employerId, monthKey, affiliated, encodings, secondaryWork, corrections])

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

  // Mode guidé pas à pas : démarrer la simulation à l'étape « Connexion simulée ».
  useEffect(() => {
    if (!startLoginSignal) return
    goToStep('login', true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startLoginSignal])

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
        // Premier jour ajouté à une sélection vide : pré-remplir le sélecteur
        // avec l'état actuel de ce jour (situation principale + T2).
        if (prev.size === 0 && next.size === 1) {
          setSelectorSituation(encodings[date] ?? 'temporary_unemployment')
          setSelectorSecondaryWork(secondaryWork[date] ?? [])
        }
        return next
      })
      setShowUnsaved(false)
    },
    [isLocked, encodings, secondaryWork],
  )

  const clearSelection = useCallback(() => {
    setSelectedDates(new Set())
    setSelectorOpen(false)
    setShowUnsaved(false)
    setSelectorSituation('temporary_unemployment')
    setSelectorSecondaryWork([])
  }, [])

  /** Bascule une des 3 cases ■/▲/👥 dans le sélecteur (gère l'exclusion ■⊕▲). */
  const toggleSelectorSecondary = useCallback(
    (situation: Ec32SituationType, checked: boolean) => {
      setSelectorSecondaryWork((prev) => {
        const isExclusive = (
          EC32_WORK_ELSEWHERE_EXCLUSIVE as readonly Ec32SituationType[]
        ).includes(situation)
        let next = prev.filter((s) => s !== situation)
        if (checked) {
          if (isExclusive) {
            // Retire l'autre option exclusive (exclusion ■/▲).
            next = next.filter(
              (s) => !(EC32_WORK_ELSEWHERE_EXCLUSIVE as readonly Ec32SituationType[]).includes(s),
            )
          }
          next.push(situation)
        }
        return next
      })
    },
    [],
  )

  const applySituationToSelection = useCallback(() => {
    if (selectedDates.size === 0) return
    setEncodings((prev) => {
      const next = { ...prev }
      for (const date of selectedDates) {
        next[date] = selectorSituation
      }
      return next
    })
    setSecondaryWork((prev) => {
      const next = { ...prev }
      for (const date of selectedDates) {
        if (selectorSecondaryWork.length > 0) next[date] = [...selectorSecondaryWork]
        else delete next[date]
      }
      return next
    })
    clearSelection()
  }, [selectedDates, selectorSituation, selectorSecondaryWork, clearSelection])

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
    setDeclarationChecked(true)
    setDeclarationMonth(DEFAULT_MONTH_KEY)
    setEmployerId(DEFAULT_EMPLOYER_ID)
    setMonthKey(DEFAULT_MONTH_KEY)
    setAffiliated(true)
    setEncodings({})
    setSecondaryWork({})
    setCorrections({})
    clearSelection()
    setSelectorSituation('temporary_unemployment')
    setSelectorSecondaryWork([])
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

  const goPrevStep = () => {
    const idx = stepIndex(activeStep)
    if (idx > 0) goToStep(EC32_STEPS[idx - 1])
  }
  const goNextStep = () => {
    const idx = stepIndex(activeStep)
    if (idx < EC32_STEPS.length - 1) goToStep(EC32_STEPS[idx + 1])
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

      {/* Grille : contenu à gauche, disclaimer à droite. */}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_clamp(200px,22%,260px)] lg:items-start">
        <div className="min-w-0 space-y-5">
          {activeStep === 'login' && (
            <StepLogin
              getLabel={getLabel}
              getNotice={getNotice}
              revealed={revealedLogin}
              onReveal={setRevealedLogin}
              onRestart={restart}
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
              onRestart={restart}
              onPrev={goPrevStep}
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
              onRestart={restart}
              onPrev={goPrevStep}
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
              onRestart={restart}
              onPrev={goPrevStep}
              onContinue={() => goToStep('calendar')}
            />
          )}

          {isAppStep && (
            <CardWorkspace
              activeStep={activeStep}
              content={content}
              getLabel={getLabel}
              getNotice={getNotice}
              employer={employer}
              monthLabel={monthLabel}
              cells={cells}
              selectedDates={selectedDates}
              previewSituation={selectorSituation}
              previewSecondaryWork={selectorSecondaryWork}
              employerName={employer?.name || ''}
              situationLabel={situationLabel}
              isLocked={isLocked}
              cardStatus={cardStatus}
              formatDate={formatDate}
              onToggleDay={toggleDay}
              onEditDay={openCorrection}
              onRestart={restart}
              onPrev={goPrevStep}
              onNext={goNextStep}
              rightPanel={
                selectedDates.size > 0 && !isLocked ? (
                  <Ec32AdaptPanel
                    getLabel={getLabel}
                    selectedDates={selectedDates}
                    cells={cells}
                    selectorSituation={selectorSituation}
                    selectorSecondaryWork={selectorSecondaryWork}
                    employerName={employer?.name || ''}
                    suggestedSituation={suggestedSituation}
                    situationLabel={situationLabel}
                    formatDate={formatDate}
                    onSelectorSituation={setSelectorSituation}
                    onToggleSelectorSecondary={toggleSelectorSecondary}
                    onApplySituation={applySituationToSelection}
                    onClearSelection={clearSelection}
                  />
                ) : (
                  <Ec32ControlsPanel
                    getLabel={getLabel}
                    getNotice={getNotice}
                    affiliated={affiliated}
                    onAffiliationChange={setAffiliated}
                    firstSendLabel={firstSendLabel}
                    sendAllowed={sendAllowed}
                    isLocked={isLocked}
                    onAdvanceToSend={advanceToFirstSendDay}
                    onExportPdf={handleExportPdf}
                    onOpenSend={() => setSendOpen(true)}
                  />
                )
              }
            />
          )}

        </div>

        {/* Rail droit : simulation pédagogique non officielle. */}
        <div className="hidden lg:block">
          <Ec32Card className="space-y-3 p-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-4 shrink-0 text-primary" aria-hidden />
              <p className="text-xs font-semibold text-foreground">{content.legal.simulationLabel}</p>
            </div>
            <ul className="space-y-2">
              {[content.legal.noRealData, content.legal.noTransmission, content.legal.notReplacement]
                .filter(Boolean)
                .map((point, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <Check className="mt-0.5 size-3 shrink-0 text-primary" aria-hidden />
                    <span className="text-xs text-muted-foreground">{point}</span>
                  </li>
                ))}
            </ul>
          </Ec32Card>
        </div>
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

function StepLogin({
  getLabel,
  getNotice,
  revealed,
  onReveal,
  onRestart,
  onContinue,
}: {
  getLabel: (key: string, fallback?: string) => string
  getNotice: (key: string) => string
  revealed: string | null
  onReveal: (key: string) => void
  onRestart: () => void
  onContinue: () => void
}) {
  const [consentOpen, setConsentOpen] = useState(false)
  // Le consentement OAuth (durée 23 mois) s'applique aux moyens fédéraux
  // eID/itsme dans la vraie app. On le propose en aperçu pédagogique.
  const canShowConsent = revealed === 'eid' || revealed === 'itsme'

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

      {canShowConsent && (
        <div className="mt-3 rounded-2xl border border-primary/20 bg-primary/5 p-3">
          <p className="text-xs font-semibold text-foreground">
            Lors de la première connexion, un écran d’autorisation s’affiche
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            L’application demande l’accès à vos données pour une durée de{' '}
            <strong className="text-foreground">23 mois</strong>, renouvelée à
            l’expiration.
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="mt-2"
            onClick={() => setConsentOpen(true)}
          >
            Voir l’écran de consentement
          </Button>
        </div>
      )}

      <div className="mt-5 flex items-center justify-between gap-3 border-t border-border pt-4">
        <Button type="button" variant="ghost" size="sm" onClick={onRestart}>
          <RotateCcw className="size-3.5" aria-hidden />
          {getLabel('nav.restart')}
        </Button>
        <Button type="button" onClick={onContinue}>
          {getLabel('login.continue')}
        </Button>
      </div>

      <Dialog open={consentOpen} onOpenChange={setConsentOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="sr-only">
              Écran de consentement — simulation
            </DialogTitle>
          </DialogHeader>
          <Ec32OAuthConsent
            onConfirm={() => setConsentOpen(false)}
            onCancel={() => setConsentOpen(false)}
          />
        </DialogContent>
      </Dialog>
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
  onRestart,
  onPrev,
  onContinue,
}: {
  getLabel: (key: string, fallback?: string) => string
  getNotice: (key: string) => string
  months: Ec32MonthContent[]
  month: string
  checked: boolean
  onMonthChange: (key: string) => void
  onCheckedChange: (v: boolean) => void
  onRestart: () => void
  onPrev: () => void
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

      <div className="mt-5 flex items-center justify-between gap-3 border-t border-border pt-4">
        <Button type="button" variant="ghost" size="sm" onClick={onRestart}>
          <RotateCcw className="size-3.5" aria-hidden />
          {getLabel('nav.restart')}
        </Button>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onPrev}>
            {getLabel('nav.back')}
          </Button>
          <Button type="button" onClick={onContinue} disabled={!checked}>
            {getLabel('declaration.continue')}
          </Button>
        </div>
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
  onRestart,
  onPrev,
  onContinue,
}: {
  getLabel: (key: string, fallback?: string) => string
  getNotice: (key: string) => string
  employers: Ec32EmployerContent[]
  employerId: string
  onSelect: (id: string) => void
  onRestart: () => void
  onPrev: () => void
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

      <div className="mt-5 flex items-center justify-between gap-3 border-t border-border pt-4">
        <Button type="button" variant="ghost" size="sm" onClick={onRestart}>
          <RotateCcw className="size-3.5" aria-hidden />
          {getLabel('nav.restart')}
        </Button>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onPrev}>
            {getLabel('nav.back')}
          </Button>
          <Button type="button" onClick={onContinue} disabled={!selected}>
            {getLabel('employer.continue')}
          </Button>
        </div>
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
  onRestart,
  onPrev,
  onContinue,
}: {
  getLabel: (key: string, fallback?: string) => string
  getNotice: (key: string) => string
  months: Ec32MonthContent[]
  monthKey: string
  onSelect: (key: string) => void
  onRestart: () => void
  onPrev: () => void
  onContinue: () => void
}) {
  const [pastActivated, setPastActivated] = useState(false)

  return (
    <Ec32Card>
      <h3 className="text-lg font-bold text-foreground">{getLabel('month.title')}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{getLabel('month.intro')}</p>

      <Ec32InfoBox tone="warning" className="mt-4">
        {getNotice('month.rule')}
      </Ec32InfoBox>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {months.map((m) => {
          const b = getMonthBehavior(m.key)
          const isSent = b?.status === 'sent'
          const isFuture = b?.status === 'locked'
          const locked = isSent || isFuture
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
                {isSent
                  ? getLabel('month.locked')
                  : isFuture
                    ? getLabel('month.notYet')
                    : m.statusNote}
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

      <div className="mt-5 flex items-center justify-between gap-3 border-t border-border pt-4">
        <Button type="button" variant="ghost" size="sm" onClick={onRestart}>
          <RotateCcw className="size-3.5" aria-hidden />
          {getLabel('nav.restart')}
        </Button>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onPrev}>
            {getLabel('nav.back')}
          </Button>
          <Button type="button" onClick={onContinue}>
            {getLabel('nav.toCalendar')}
          </Button>
        </div>
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
  selectedDates,
  previewSituation,
  previewSecondaryWork,
  employerName: _employerName,
  situationLabel,
  isLocked,
  cardStatus,
  formatDate,
  onToggleDay,
  onEditDay,
  onRestart,
  onPrev,
  onNext,
  rightPanel,
}: {
  activeStep: Ec32StepKey
  content: Ec32Content
  getLabel: (key: string, fallback?: string) => string
  getNotice: (key: string) => string
  employer: Ec32EmployerContent | undefined
  monthLabel: string
  cells: Ec32DayCell[]
  selectedDates: Set<string>
  /** Situation en cours de choix dans le rail (aperçu live sur les jours sélectionnés). */
  previewSituation: Ec32SituationType
  /** Axe secondaire en cours de choix (aperçu live). */
  previewSecondaryWork: Ec32SituationType[]
  /** Nom de l'employeur (injecté dans les libellés du sélecteur). */
  employerName: string
  situationLabel: (s: Ec32SituationType) => string
  isLocked: boolean
  cardStatus: Ec32CardStatus
  formatDate: (iso: string) => string
  onToggleDay: (date: string) => void
  onEditDay: (date: string) => void
  onRestart: () => void
  onPrev: () => void
  onNext: () => void
  /** Panel contextuel affiché à droite du calendrier dans la carte. */
  rightPanel?: ReactNode
}) {
  // Aperçu live : les jours sélectionnés adoptent la couleur de la situation en
  // cours de choix dans le rail, avant même l'enregistrement.
  const calendarCells =
    selectedDates.size > 0
      ? cells.map((c) =>
          selectedDates.has(c.date)
            ? {
                ...c,
                situation: previewSituation,
                secondaryWork: previewSecondaryWork,
              }
            : c,
        )
      : cells

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

        {/* Recommencer la simulation — en haut à droite de la carte. */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onRestart}
          className="shrink-0"
        >
          <RotateCcw className="size-3.5" aria-hidden />
          {getLabel('nav.restart')}
        </Button>
      </div>

      <p className="mt-3 text-xs italic text-muted-foreground">
        {content.simulator.fictitiousDataNotice}
      </p>

      {/* Corps : calendrier gauche + panel contextuel droit.
          Deux colonnes équilibrées et centrées (le calendrier garde sa taille
          idéale ~500px, le panel respire au lieu d'être écrasé). Empilées en
          mobile/tablette, côte à côte dès lg. */}
      <div
        className={cn(
          'mt-3',
          rightPanel &&
            'grid gap-6 lg:grid-cols-[minmax(0,500px)_minmax(260px,340px)] lg:items-start lg:justify-center lg:gap-10',
        )}
      >
        <div className="mx-auto w-full max-w-[500px] space-y-3 lg:mx-0">
          {activeStep === 'calendar' && (
            <Ec32InfoBox tone="info">
              {getNotice('calendar.defaultChomage')}
            </Ec32InfoBox>
          )}
          {activeStep === 'verify' && (
            <Ec32InfoBox tone="neutral" icon={ListChecks} title={getLabel('verify.title')}>
              {getLabel('verify.intro')}
            </Ec32InfoBox>
          )}
          {activeStep === 'correction' && (
            <Ec32InfoBox tone="info" icon={PencilLine}>
              {getNotice('correction.help')}
            </Ec32InfoBox>
          )}
          <Ec32Calendar
            cells={calendarCells}
            selectedDates={selectedDates}
            situationLabel={situationLabel}
            legendTitle={getLabel('calendar.legend')}
            selectHint={getLabel('calendar.selectHint')}
            disabled={isLocked}
            onToggleDay={activeStep === 'correction' ? onEditDay : onToggleDay}
          />
        </div>

        {rightPanel && (
          <div className="mx-auto w-full max-w-[500px] border-t border-border/60 pt-4 lg:mx-0 lg:max-w-none lg:border-l lg:border-t-0 lg:pl-6 lg:pt-1">
            {rightPanel}
          </div>
        )}
      </div>

      {/* Navigation entre étapes — dans la carte. */}
      <div className="mt-5 flex justify-end gap-2 border-t border-border pt-4">
        <Button type="button" variant="outline" size="sm" onClick={onPrev}>
          {getLabel('nav.back')}
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={onNext}
          disabled={EC32_STEPS.indexOf(activeStep) >= EC32_STEPS.length - 1}
        >
          {getLabel('nav.next')}
        </Button>
      </div>
    </Ec32Card>
  )
}

// ═════════════════════════ Rail contextuel (étape carte) ═════════════════════════

/** « Adapter les jours sélectionnés » (rail) : récap du jour sélectionné +
 *  sélecteur de situation. Remplace « Contrôles & validation » dès qu'au moins
 *  un jour est sélectionné dans le calendrier. */
function Ec32AdaptPanel({
  getLabel,
  selectedDates,
  cells,
  selectorSituation,
  selectorSecondaryWork,
  employerName,
  suggestedSituation,
  situationLabel,
  formatDate,
  onSelectorSituation,
  onToggleSelectorSecondary,
  onApplySituation,
  onClearSelection,
}: {
  getLabel: (key: string, fallback?: string) => string
  selectedDates: Set<string>
  cells: Ec32DayCell[]
  selectorSituation: Ec32SituationType
  selectorSecondaryWork: Ec32SituationType[]
  employerName: string
  suggestedSituation: Ec32SituationType | null
  situationLabel: (s: Ec32SituationType) => string
  formatDate: (iso: string) => string
  onSelectorSituation: (s: Ec32SituationType) => void
  onToggleSelectorSecondary: (situation: Ec32SituationType, checked: boolean) => void
  onApplySituation: () => void
  onClearSelection: () => void
}) {
  const dates = Array.from(selectedDates).sort()
  const count = dates.length
  const firstDate = dates[0]
  const firstCell = firstDate ? cells.find((c) => c.date === firstDate) : undefined

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <CalendarDays className="size-4 shrink-0 text-primary" aria-hidden />
          <h3 className="truncate text-sm font-bold text-foreground">{getLabel('card.adapt')}</h3>
        </div>
        <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
          {count} {getLabel('selector.selected')}
        </span>
      </div>

      <p className="text-xs leading-relaxed text-muted-foreground">
        {count === 1 && firstDate ? (
          <>
            <span className="font-medium text-foreground">{formatDate(firstDate)}</span>
            {firstCell && (
              <>
                {' · '}
                {situationLabel(firstCell.situation)}
                {(firstCell.secondaryWork ?? []).length > 0 && ' + travail ailleurs'}
              </>
            )}
          </>
        ) : (
          <>Statut à appliquer à ces {count} jours :</>
        )}
      </p>

      <Ec32SituationSelector
        selectedCount={count}
        value={selectorSituation}
        secondaryWork={selectorSecondaryWork}
        employerName={employerName || "l’employeur"}
        saveLabel={count > 1 ? getLabel('selector.saveMulti') : getLabel('selector.save')}
        cancelLabel={getLabel('selector.cancel')}
        suggestedSituation={suggestedSituation}
        situationLabel={situationLabel}
        onChange={onSelectorSituation}
        onSecondaryToggle={onToggleSelectorSecondary}
        onSave={onApplySituation}
        onCancel={onClearSelection}
      />
    </div>
  )
}

/** Contrôles & validation (rail) : affiliation, première date d'envoi, actions. */
function Ec32ControlsPanel({
  getLabel,
  getNotice,
  affiliated,
  onAffiliationChange,
  firstSendLabel,
  sendAllowed,
  isLocked,
  onAdvanceToSend,
  onExportPdf,
  onOpenSend,
}: {
  getLabel: (key: string, fallback?: string) => string
  getNotice: (key: string) => string
  affiliated: boolean
  onAffiliationChange: (v: boolean) => void
  firstSendLabel: string
  sendAllowed: boolean
  isLocked: boolean
  onAdvanceToSend: () => void
  onExportPdf: () => void
  onOpenSend: () => void
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <ListChecks className="size-4 shrink-0 text-primary" aria-hidden />
        <h3 className="text-sm font-bold text-foreground">Contrôles &amp; validation</h3>
      </div>

      {/* Affiliation organisme de paiement */}
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-3">
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
      <div className="rounded-2xl border border-border bg-muted/30 p-3">
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
              className="mt-3 w-full"
              onClick={onAdvanceToSend}
            >
              <FastForward className="size-3.5" aria-hidden />
              Avancer jusqu’à la première date d’envoi
            </Button>
          </>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-2">
        <Button type="button" variant="outline" className="w-full" onClick={onExportPdf}>
          <Download className="size-4" aria-hidden />
          {getLabel('card.download')}
        </Button>
        {!isLocked && (
          <Button
            type="button"
            className="w-full"
            onClick={onOpenSend}
            disabled={!sendAllowed}
            aria-disabled={!sendAllowed}
          >
            <Send className="size-4" aria-hidden />
            {getLabel('card.send')}
          </Button>
        )}
        {isLocked && (
          <span className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
            <Check className="size-3.5" aria-hidden />
            Carte envoyée — simulation
          </span>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────── util ───────────────────────────

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}
