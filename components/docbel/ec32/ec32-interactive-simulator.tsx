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
import { useTranslations } from 'next-intl'
import {
  Building2,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
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
import {
  ec32Label,
  ec32LabelKey,
  ec32Notice,
  ec32NoticeKey,
  ec32ResolveKey,
  type Ec32Translator,
} from '@/lib/ec32/labels'
import { exportEc32SimulationPdf } from '@/lib/ec32/export-pdf'
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
import { Ec32SimulatorArt } from '@/components/docbel/ec32/ec32-simulator-art'
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
  DialogTitle,
} from '@/components/ui/dialog'

// ─────────────────────────── Constantes ───────────────────────────

const STORAGE_KEY = 'docbel-ec32-sim'

const FRENCH_MONTHS_SHORT_KEYS = [
  'sim.date.month.jan',
  'sim.date.month.feb',
  'sim.date.month.mar',
  'sim.date.month.apr',
  'sim.date.month.may',
  'sim.date.month.jun',
  'sim.date.month.jul',
  'sim.date.month.aug',
  'sim.date.month.sep',
  'sim.date.month.oct',
  'sim.date.month.nov',
  'sim.date.month.dec',
] as const

const FRENCH_WEEKDAYS_SHORT_KEYS = [
  'sim.date.weekday.sun',
  'sim.date.weekday.mon',
  'sim.date.weekday.tue',
  'sim.date.weekday.wed',
  'sim.date.weekday.thu',
  'sim.date.weekday.fri',
  'sim.date.weekday.sat',
] as const

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
  const t = useTranslations('public.ec32')
  const tRoot = useTranslations() as unknown as Ec32Translator
  const sim = content.simulator

  // ── Helpers de libellés / notices (i18n → contenu éditable → repli codé) ──
  // Priorité : clé i18n parallèle (next-intl, `public.ec32Content.{labels,notices}.*`)
  // si résolue, sinon valeur du builder, sinon repli FR codé en dur.
  const getLabel = useCallback(
    (key: string, fallback?: string): string => {
      const entry = sim.labels.find((l) => l.key === key)
      const fromContent = entry?.text?.trim()
      const builderOrFallback =
        fromContent || ec32Label(key) || fallback || key
      const i18nKey = entry?.textKey || ec32LabelKey(key)
      return ec32ResolveKey(tRoot, i18nKey, builderOrFallback)
    },
    [sim.labels, tRoot],
  )

  const getNotice = useCallback(
    (key: string): string => {
      const entry = sim.notices.find((n) => n.key === key)
      const fromContent = entry?.text?.trim()
      const builderOrFallback = fromContent || ec32Notice(key)
      const i18nKey = entry?.textKey || ec32NoticeKey(key)
      return ec32ResolveKey(tRoot, i18nKey, builderOrFallback)
    },
    [sim.notices, tRoot],
  )

  const situationLabel = useCallback(
    (situation: Ec32SituationType): string => {
      const found = sim.situations.find((s) => s.type === situation)
      const fallback =
        found?.shortLabel?.trim() || found?.label?.trim() || situation
      return ec32ResolveKey(tRoot, found?.shortLabelKey, fallback)
    },
    [sim.situations, tRoot],
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

  // i18n : la clé parallèle `labelKey` est résolue si disponible, sinon FR du contenu.
  const monthLabel = monthContent
    ? ec32ResolveKey(
        tRoot,
        monthContent.labelKey,
        monthContent.label?.trim() || monthKey,
      )
    : monthKey

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
  const formatDate = useCallback(
    (iso: string): string => {
      const [y, m, d] = iso.split('-').map((n) => Number.parseInt(n, 10))
      if (!y || !m || !d) return iso
      const weekday = new Date(y, m - 1, d).getDay()
      const weekdayLabel = t(FRENCH_WEEKDAYS_SHORT_KEYS[weekday] as Parameters<typeof t>[0])
      const monthLabelShort = t(FRENCH_MONTHS_SHORT_KEYS[m - 1] as Parameters<typeof t>[0])
      return `${weekdayLabel} ${d} ${monthLabelShort} ${y}`
    },
    [t],
  )

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
    // i18n : résoudre la clé parallèle `hintKey` si disponible, sinon FR `hint`.
    const resolvedHint = ec32ResolveKey(tRoot, preset.hintKey, preset.hint ?? '')
    setScenarioHint(resolvedHint || null)

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
    await exportEc32SimulationPdf({
      monthLabel,
      employerName: employer?.name || '—',
      enterpriseNumber: employer?.enterpriseNumber || '—',
      occupationPeriod: employer?.sector || undefined,
      // Données travailleur fictives (jamais de NISS/identité réelle).
      workerName: t('sim.pdf.workerName'),
      workerNiss: t('sim.pdf.workerNiss'),
      generatedAtLabel: formatDate(
        new Date(behavior?.year ?? 2025, (behavior?.month ?? 1) - 1, simulatedDay)
          .toISOString()
          .slice(0, 10),
      ),
      sent: isLocked,
      cells,
      fictionMention: sim.pdf.fictionMention || t('sim.pdf.fictionMention'),
    })
  }, [cells, formatDate, sim.pdf, monthLabel, employer, isLocked, behavior, simulatedDay, t])

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
    dayLabel: sim.correctionModal.dayLabel || t('sim.correctionModal.dayLabel'),
    fromLabel: sim.correctionModal.fromLabel || t('sim.correctionModal.fromLabel'),
    toLabel: sim.correctionModal.toLabel || t('sim.correctionModal.toLabel'),
    reasonLabel: sim.correctionModal.reasonLabel || t('sim.correctionModal.reasonLabel'),
    reasonPlaceholder:
      sim.correctionModal.reasonPlaceholder || t('sim.correctionModal.reasonPlaceholder'),
    saveLabel: sim.correctionModal.saveLabel || t('sim.correctionModal.saveLabel'),
    lockedMessage: sim.correctionModal.lockedMessage || getNotice('correction.locked'),
    requiredError: sim.correctionModal.requiredError || t('sim.correctionModal.requiredError'),
  }

  const sendLabels: Ec32SendModalLabels = {
    title: sim.sendModal.title || ec32Label('card.send'),
    body: sim.sendModal.body || '',
    cancelLabel: sim.sendModal.cancelLabel || t('sim.sendModal.cancelLabel'),
    confirmLabel: sim.sendModal.confirmLabel || t('sim.sendModal.confirmLabel'),
    successTitle: sim.sendModal.successTitle || t('sim.sendModal.successTitle'),
    successBody: sim.sendModal.successBody || '',
    blockedTitle: sim.sendModal.blockedTitle || t('sim.sendModal.blockedTitle'),
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
      eyebrow={t('sim.eyebrow')}
      title={sim.title}
      subtitle={sim.subtitle}
      icon={CalendarDays}
      headerAside={<Ec32SimulatorArt />}
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

      {/* Note pédagogique « données fictives » — ton informatif (bleu),
          rassurant plutôt qu'alarmant. */}
      {sim.fictitiousDataNotice && (
        <Ec32InfoBox tone="info" className="mb-5">
          {sim.fictitiousDataNotice}
        </Ec32InfoBox>
      )}

      {showUnsaved && (
        <Ec32InfoBox tone="warning" className="mb-5" title={t('sim.unsavedTitle')}>
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
        monthLabel={monthLabel}
        employerName={employer?.name}
        onOpenChange={setSendOpen}
        onConfirm={confirmSend}
        onDownloadPdf={handleExportPdf}
      />
    </Ec32Section>
  )
}

// ═════════════════════════ Sous-composants d'étape ═════════════════════════

/**
 * Barre de navigation entre étapes (pied de carte), partagée par toutes les
 * étapes. Reste TOUJOURS dans la carte : `flex-wrap` empêche tout débordement,
 * et les libellés se raccourcissent sous le breakpoint `sm` (mobile) — le texte
 * complet réapparaît dès l'espace disponible. `primary*` = action principale
 * (Continuer / Choisir / Suivant…), step-spécifique.
 */
function Ec32StepNav({
  getLabel,
  onRestart,
  onPrev,
  onPrimary,
  primaryLabel,
  primaryShortLabel,
  primaryDisabled = false,
  primaryIconEnd,
}: {
  getLabel: (key: string, fallback?: string) => string
  onRestart?: () => void
  onPrev?: () => void
  onPrimary?: () => void
  /** Libellé complet de l'action principale (≥ sm). */
  primaryLabel?: string
  /** Libellé court affiché sous `sm` (défaut : `primaryLabel`). */
  primaryShortLabel?: string
  primaryDisabled?: boolean
  /** Icône optionnelle après le libellé (ex. flèche « Suivant »). */
  primaryIconEnd?: ReactNode
}) {
  const t = useTranslations('public.ec32')
  return (
    <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
      {onRestart ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onRestart}
          className="min-w-0 shrink"
        >
          <RotateCcw className="size-3.5 shrink-0" aria-hidden />
          <span className="hidden sm:inline">{getLabel('nav.restart')}</span>
          <span className="sm:hidden">{t('sim.nav.restartShort')}</span>
        </Button>
      ) : (
        <span aria-hidden />
      )}

      <div className="flex shrink-0 items-center gap-2">
        {onPrev && (
          <Button type="button" variant="outline" size="sm" onClick={onPrev}>
            <ChevronLeft className="size-3.5 shrink-0" aria-hidden />
            <span className="hidden sm:inline">{getLabel('nav.back')}</span>
            <span className="sm:hidden">{t('sim.nav.backShort')}</span>
          </Button>
        )}
        {onPrimary && (
          <Button type="button" onClick={onPrimary} disabled={primaryDisabled}>
            <span className="hidden sm:inline">{primaryLabel}</span>
            <span className="sm:hidden">{primaryShortLabel ?? primaryLabel}</span>
            {primaryIconEnd}
          </Button>
        )}
      </div>
    </div>
  )
}

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
  const tx = useTranslations('public.outils')
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
            {tx('ec32Sim.consentFirstLoginTitle')}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {tx.rich('ec32Sim.consentFirstLoginBody', {
              strong: (chunks) => (
                <strong className="text-foreground">{chunks}</strong>
              ),
            })}
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="mt-2"
            onClick={() => setConsentOpen(true)}
          >
            {tx('ec32Sim.consentShowScreen')}
          </Button>
        </div>
      )}

      <Ec32StepNav
        getLabel={getLabel}
        onRestart={onRestart}
        onPrimary={onContinue}
        primaryLabel={getLabel('login.continue')}
        primaryShortLabel={tx('ec32Sim.shortStart')}
      />

      <Dialog open={consentOpen} onOpenChange={setConsentOpen}>
        <DialogContent
          showCloseButton={false}
          className="border-0 bg-transparent p-0 shadow-none ring-0 sm:max-w-2xl"
        >
          <DialogTitle className="sr-only">
            {tx('ec32Sim.consentDialogTitle')}
          </DialogTitle>
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
  const tx = useTranslations('public.outils')
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

      <Ec32StepNav
        getLabel={getLabel}
        onRestart={onRestart}
        onPrev={onPrev}
        onPrimary={onContinue}
        primaryLabel={getLabel('declaration.continue')}
        primaryShortLabel={tx('ec32Sim.shortContinue')}
        primaryDisabled={!checked}
      />
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
  const tx = useTranslations('public.outils')
  const tRoot = useTranslations() as unknown as Ec32Translator
  const selected = employers.find((e) => e.id === employerId)
  const isConstruction = selected?.type === 'construction_cp124'

  return (
    <Ec32Card>
      <h3 className="text-lg font-bold text-foreground">{getLabel('employer.title')}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{getLabel('employer.intro')}</p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {employers.map((emp) => {
          const isActive = emp.id === employerId
          const name = ec32ResolveKey(tRoot, emp.nameKey, emp.name)
          const sector = ec32ResolveKey(tRoot, emp.sectorKey, emp.sector)
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
                <span className="font-semibold text-foreground">{name}</span>
                {isActive && <Check className="ml-auto size-4 text-primary" aria-hidden />}
              </span>
              <span className="text-xs text-muted-foreground">{sector}</span>
              <span className="text-xs text-muted-foreground">
                {getLabel('employer.enterprise')} : {emp.enterpriseNumber}
              </span>
            </button>
          )
        })}
      </div>

      <Ec32InfoBox tone="neutral" className="mt-4" title={tx('ec32Sim.employerCountTitle')}>
        <ul className="list-disc space-y-1 pl-4">
          <li>{tx('ec32Sim.employerCount1')}</li>
          <li>{tx('ec32Sim.employerCount2')}</li>
          <li>{tx('ec32Sim.employerCount3plus')}</li>
        </ul>
      </Ec32InfoBox>

      {isConstruction && (
        <Ec32InfoBox tone="warning" className="mt-3" title={tx('ec32Sim.constructionSectorTitle')}>
          {getNotice('calendar.fillUntilEnd')}
        </Ec32InfoBox>
      )}

      <Ec32StepNav
        getLabel={getLabel}
        onRestart={onRestart}
        onPrev={onPrev}
        onPrimary={onContinue}
        primaryLabel={getLabel('employer.continue')}
        primaryShortLabel={tx('ec32Sim.shortChoose')}
        primaryDisabled={!selected}
      />
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
  const tx = useTranslations('public.outils')
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

      <Ec32StepNav
        getLabel={getLabel}
        onRestart={onRestart}
        onPrev={onPrev}
        onPrimary={onContinue}
        primaryLabel={getLabel('nav.toCalendar')}
        primaryShortLabel={tx('ec32Sim.shortCalendar')}
      />
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
  const tx = useTranslations('public.outils')
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
              <dt className="inline font-medium text-foreground">{tx('ec32Sim.monthLabel')} : </dt>
              <dd className="inline">{monthLabel}</dd>
            </div>
            <div>
              <dt className="inline font-medium text-foreground">{getLabel('card.lastUpdate')} : </dt>
              <dd className="inline">
                {tx('ec32Sim.simulationDate', {
                  date: formatDate(cells.find((c) => c.inMonth)?.date ?? '2025-05-01'),
                })}
              </dd>
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
      <Ec32StepNav
        getLabel={getLabel}
        onPrev={onPrev}
        onPrimary={onNext}
        primaryLabel={getLabel('nav.next')}
        primaryShortLabel={tx('ec32Sim.shortNext')}
        primaryDisabled={EC32_STEPS.indexOf(activeStep) >= EC32_STEPS.length - 1}
        primaryIconEnd={<ChevronRight className="size-3.5 shrink-0" aria-hidden />}
      />
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
  const tx = useTranslations('public.outils')
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
                {(firstCell.secondaryWork ?? []).length > 0 &&
                  tx('ec32Sim.plusElsewhereSuffix')}
              </>
            )}
          </>
        ) : (
          tx('ec32Sim.applyStatusTo', { count })
        )}
      </p>

      <Ec32SituationSelector
        selectedCount={count}
        value={selectorSituation}
        secondaryWork={selectorSecondaryWork}
        employerName={employerName || tx('ec32Sim.defaultEmployerName')}
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
  const tx = useTranslations('public.outils')
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <ListChecks className="size-4 shrink-0 text-primary" aria-hidden />
        <h3 className="text-sm font-bold text-foreground">{tx('ec32Sim.controlsValidation')}</h3>
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
              {tx('ec32Sim.advanceToFirstSend')}
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
          <span className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[color:var(--glass-success-surface)] px-3 py-2 text-xs font-medium text-[color:var(--glass-success-ink)]">
            <Check className="size-3.5" aria-hidden />
            {tx('ec32Sim.cardSentSimulation')}
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
