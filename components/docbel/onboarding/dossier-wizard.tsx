"use client";

// Orientation wizard de `/mon-dossier` (colonne gauche du mockup).
//
// Parcours guidé : « Quelle est votre situation ? » → sous-question éventuelle →
// dossier recommandé. 4 étapes visibles dans le stepper :
//
//   1. Votre situation   ✱ active dès le chargement
//   2. Vos besoins       ✱ devient active après sélection step 1
//   3. Affinons          ✱ TOUJOURS inactive pour l'instant (pas encore de
//                          raffinement multi-dossiers). Elle reste affichée
//                          en gris clair comme indicateur de progression future.
//   4. Résultat          ✱ affiche le dossier recommandé ou la carte
//                          « bientôt disponible »
//
// Garde-fou anti-bug « défaut CT » : `selectedSituation` est strictement
// requis pour quitter step 1. Aucun `defaultValue`, aucune redirection
// possible sans choix explicite.

import { createContext, useContext, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  Accessibility,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Briefcase,
  Building2,
  Check,
  ChevronRight,
  Clock,
  Construction,
  ExternalLink,
  FileText,
  GraduationCap,
  HelpCircle,
  Hourglass,
  Lock,
  MapPinned,
  RotateCcw,
  Search,
  Sparkles,
  UserMinus,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { GLASS_CARD } from "@/lib/glass-classes";
import { AllocationEstimateBlock } from "@/components/docbel/onboarding/allocation-estimate-block";
import { trackBundleEventClient } from "@/lib/bundles/analytics-client";
import {
  deriveWizardResults,
  type DerivedDossier,
  type MatchLevel,
  type WizardCatalog,
} from "@/lib/dossier-wizard/derive-results";
import type {
  WizardRefineOption,
  WizardResult,
  WizardSituation,
  WizardSubOption,
} from "@/lib/dossier-wizard/config";

/// Mapping local nom → composant lucide. Le set est petit et fixe ; on évite
/// d'élargir le `ICON_CATALOG` global qui sert au IconPicker admin et qui
/// n'a pas besoin d'embarquer ces icônes d'orientation.
const ICONS: Record<string, LucideIcon> = {
  Briefcase,
  Search,
  GraduationCap,
  Hourglass,
  Accessibility,
  HelpCircle,
  UserMinus,
  MapPinned,
};

function resolveIcon(name: string): LucideIcon {
  return ICONS[name] ?? HelpCircle;
}

/// Résout un texte localisé : préfère la clé i18n `*Key` quand elle est
/// fournie (configs hand-written via WIZARD_SITUATIONS), retombe sur le
/// texte FR brut (path adapter DB → WizardSituation, qui ne pose pas de clés).
function resolveText(
  t: ReturnType<typeof useTranslations>,
  key: string | undefined,
  fallback: string,
): string {
  if (!key) return fallback;
  try {
    const v = t(key as Parameters<typeof t>[0]);
    return v && v !== key ? v : fallback;
  } catch {
    return fallback;
  }
}

interface Props {
  situations: WizardSituation[];
  /// Catalogue des bundles (slug → méta) pour enrichir le résultat
  /// (documents, points d'attention, dossiers proches). Optionnel : si vide,
  /// le résultat se limite au titre + explication de la config.
  catalog?: WizardCatalog;
  /// Mode « test » (simulation admin) : désactive l'envoi d'analytics ET
  /// neutralise la navigation des CTA de résultat (on ne quitte pas l'éditeur).
  /// Additif, défaut `false` → comportement public inchangé.
  dryRun?: boolean;
}

/// Contexte de mode test, lu par les sous-composants de résultat pour gater
/// l'analytics et la navigation.
const DryRunContext = createContext(false);
function useDryRun() {
  return useContext(DryRunContext);
}

type StepNumber = 1 | 2 | 3 | 4;

const STEP_LABEL_KEYS: Record<StepNumber, string> = {
  1: "wizardStep1",
  2: "wizardStep2",
  3: "wizardStep3",
  4: "wizardStep4",
};

export function DossierWizard({ situations, catalog = {}, dryRun = false }: Props) {
  const t = useTranslations("public.dossier");
  const tc = useTranslations("public.dossierContent");
  const [currentStep, setCurrentStep] = useState<StepNumber>(1);
  // N'émet `wizard_started` qu'une fois par session de wizard.
  const startedRef = useRef(false);
  // En mode test, on n'émet aucun event analytics.
  const track: typeof trackBundleEventClient = dryRun ? () => {} : trackBundleEventClient;
  const [selectedSituation, setSelectedSituation] = useState<string | null>(
    null,
  );
  const [selectedSubOption, setSelectedSubOption] = useState<string | null>(
    null,
  );
  const [selectedRefine, setSelectedRefine] = useState<string | null>(null);

  const situation =
    situations.find((s) => s.value === selectedSituation) ?? null;
  const subOption: WizardSubOption | null =
    situation?.subQuestion?.options.find(
      (opt) => opt.value === selectedSubOption,
    ) ?? null;
  const refineOption: WizardRefineOption | null =
    subOption?.refineQuestion?.options.find(
      (opt) => opt.value === selectedRefine,
    ) ?? null;

  /// Le résultat n'est défini qu'en step 4. Provenance, par ordre de
  /// spécificité : raffinement (step 3) > sous-option (step 2) > situation.
  const result: WizardResult | null =
    refineOption?.result ?? subOption?.result ?? situation?.result ?? null;

  function handleSituationSelect(value: string) {
    const next = situations.find((s) => s.value === value);
    if (!next) return;
    if (!startedRef.current) {
      startedRef.current = true;
      track("wizard_started");
    }
    track("wizard_step_completed", {
      metadata: { step: 1, situation: value },
    });
    setSelectedSituation(value);
    setSelectedSubOption(null);
    setSelectedRefine(null);
    // Pas de sous-question → résultat direct (step 4). Sinon step 2.
    setCurrentStep(next.subQuestion ? 2 : 4);
  }

  function handleSubOptionSelect(value: string) {
    track("wizard_step_completed", { metadata: { step: 2 } });
    setSelectedSubOption(value);
    setSelectedRefine(null);
    const opt = situation?.subQuestion?.options.find((o) => o.value === value);
    // Si la sous-option raffine encore → step 3. Sinon → résultat (step 4).
    setCurrentStep(opt?.refineQuestion ? 3 : 4);
  }

  function handleRefineSelect(value: string) {
    track("wizard_step_completed", { metadata: { step: 3 } });
    setSelectedRefine(value);
    setCurrentStep(4);
  }

  function handleStartGuide() {
    // GARDE-FOU CRITIQUE : sans sélection, on REFUSE d'avancer. Pas de
    // défaut implicite vers chômage temporaire.
    if (!selectedSituation) {
      toast.error(t("wizardChooseSituationFirst"));
      return;
    }
    // Re-déclenche la sélection effective (utile si l'utilisateur a cliqué
    // sur une carte puis sur « Commencer » sans avoir auto-avancé — sécurité).
    handleSituationSelect(selectedSituation);
  }

  function handleBack() {
    if (currentStep === 4) {
      // Retour : si on venait d'un raffinement (step 3) → step 3 ;
      // sinon si sous-question → step 2 ; sinon step 1.
      if (subOption?.refineQuestion) {
        setCurrentStep(3);
        setSelectedRefine(null);
      } else if (situation?.subQuestion) {
        setCurrentStep(2);
        setSelectedSubOption(null);
      } else {
        setCurrentStep(1);
        setSelectedSituation(null);
      }
      return;
    }
    if (currentStep === 3) {
      setCurrentStep(2);
      setSelectedSubOption(null);
      setSelectedRefine(null);
      return;
    }
    if (currentStep === 2) {
      setCurrentStep(1);
      setSelectedSituation(null);
      setSelectedSubOption(null);
    }
  }

  function handleReset() {
    // Reset avant d'avoir atteint un résultat = abandon ; au step 4 = simple
    // « recommencer » (pas un abandon).
    if (currentStep < 4) {
      track("wizard_abandoned", {
        metadata: { step: currentStep },
      });
    }
    setCurrentStep(1);
    setSelectedSituation(null);
    setSelectedSubOption(null);
    setSelectedRefine(null);
  }

  // Capture des réponses d'orientation à l'affichage du résultat (hors test).
  // Stockées dans un cookie court, lu par POST /api/documents/bundles/[id]/run
  // qui les persiste sur le BundleRun (reprise orientation + dossier, analytics).
  useEffect(() => {
    if (dryRun || currentStep !== 4 || !result) return;
    try {
      const answers = {
        situation: { value: selectedSituation ?? "" },
        ...(selectedSubOption ? { subOption: { value: selectedSubOption } } : {}),
        ...(selectedRefine ? { refine: { value: selectedRefine } } : {}),
        ...(result.dossierSlug ? { slug: { value: result.dossierSlug } } : {}),
      };
      document.cookie = `beldoc-orientation=${encodeURIComponent(
        JSON.stringify(answers),
      )}; path=/; max-age=600; samesite=lax`;
    } catch {
      // best-effort — l'orientation reste fonctionnelle sans ce cookie.
    }
    // Mesure de la demande (dont « orpheline » : a_creer / externe).
    const availability =
      result.availability ??
      (result.dossierSlug ? "disponible" : "a_creer");
    trackBundleEventClient("wizard_result_shown", {
      bundleId: result.dossierSlug ?? undefined,
      metadata: { slug: result.dossierSlug ?? "", availability },
    });
  }, [dryRun, currentStep, result, selectedSituation, selectedSubOption, selectedRefine]);

  return (
    <DryRunContext.Provider value={dryRun}>
    <Card className={cn(GLASS_CARD, "h-full")}>
      <CardHeader>
        <CardTitle className="flex items-center gap-3 text-base">
          <span
            className="glass-icon-tile flex size-9 shrink-0 items-center justify-center rounded-xl text-[color:var(--glass-accent-deep)]"
            style={{
              background:
                "color-mix(in oklab, var(--glass-accent-deep) 14%, transparent)",
              "--tile-hue": "var(--glass-accent-deep)",
            } as React.CSSProperties}
            aria-hidden
          >
            <Sparkles className="size-4" />
          </span>
          <span className="flex flex-col gap-0.5">
            <span className="text-[17px] font-semibold leading-tight">
              {t("wizardAssistantTitle")}
            </span>
            <span className="text-xs font-normal text-muted-foreground">
              {t("wizardAssistantSubtitle")}
            </span>
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <Stepper currentStep={currentStep} />

        {/* Annonce du changement d'étape pour les lecteurs d'écran. */}
        <p className="sr-only" role="status" aria-live="polite">
          {t("wizardStepAnnounce", {
            step: currentStep,
            label: t(STEP_LABEL_KEYS[currentStep] as Parameters<typeof t>[0]),
          })}
        </p>

        {currentStep === 1 && (
          <StepSituation
            situations={situations}
            selected={selectedSituation}
            onSelect={handleSituationSelect}
            onStart={handleStartGuide}
          />
        )}

        {currentStep === 2 && situation?.subQuestion && (
          <StepSubQuestion
            situationLabel={resolveText(tc, situation.labelKey, situation.label)}
            subQuestion={situation.subQuestion}
            selected={selectedSubOption}
            onSelect={handleSubOptionSelect}
            onBack={handleBack}
          />
        )}

        {currentStep === 3 && subOption?.refineQuestion && (
          <StepRefine
            subOptionLabel={resolveText(tc, subOption.labelKey, subOption.label)}
            refineQuestion={subOption.refineQuestion}
            selected={selectedRefine}
            onSelect={handleRefineSelect}
            onBack={handleBack}
          />
        )}

        {currentStep === 4 && result && (
          <StepResults
            result={result}
            catalog={catalog}
            onBack={handleBack}
            onReset={handleReset}
          />
        )}

        {/* Échappatoire « je ne suis pas sûr » sur les étapes de questions. */}
        {currentStep < 4 &&
          (dryRun ? (
            <p className="text-center text-xs text-muted-foreground">
              {t("wizardHesitateDryRun")}
            </p>
          ) : (
            <p className="text-center text-xs text-muted-foreground">
              {t.rich("wizardHesitate", {
                link: (chunks) => (
                  <Link
                    href="/contact"
                    className="font-medium text-[color:var(--glass-accent-deep)] underline-offset-2 hover:underline"
                  >
                    {chunks}
                  </Link>
                ),
              })}
            </p>
          ))}
      </CardContent>
    </Card>
    </DryRunContext.Provider>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Stepper

interface StepperProps {
  currentStep: StepNumber;
}

function Stepper({ currentStep }: StepperProps) {
  const t = useTranslations("public.dossier");
  const steps: StepNumber[] = [1, 2, 3, 4];
  return (
    <ol
      className="flex items-center gap-2"
      aria-label={t("wizardProgressLabel")}
    >
      {steps.map((step) => {
        const isCurrent = step === currentStep;
        const isPast = step < currentStep;
        const isFuture = !isCurrent && !isPast;
        const isLast = step === 4;
        return (
          <li
            key={step}
            className={cn(
              "flex items-center gap-2",
              isLast ? "flex-none" : "flex-1",
            )}
            aria-current={isCurrent ? "step" : undefined}
          >
            <span
              className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors",
                isCurrent &&
                  "bg-[color:var(--glass-accent-deep)] text-white shadow-[0_4px_12px_color-mix(in_oklab,var(--glass-accent-deep)_45%,transparent)]",
                isPast && "bg-[color:var(--glass-accent-deep)] text-white",
                isFuture &&
                  "bg-[color:var(--glass-ink-line)] text-[color:var(--glass-ink-faint)]",
              )}
              aria-hidden
            >
              {isPast ? <Check className="size-3.5" /> : step}
            </span>
            <span
              className={cn(
                "hidden truncate text-[12.5px] font-semibold transition-colors sm:inline",
                isCurrent && "text-[color:var(--glass-ink)]",
                isPast && "text-[color:var(--glass-ink-soft)]",
                isFuture && "text-[color:var(--glass-ink-faint)]",
              )}
            >
              {t(STEP_LABEL_KEYS[step] as Parameters<typeof t>[0])}
            </span>
            {!isLast && (
              <span
                aria-hidden
                className={cn(
                  "h-px flex-1 rounded-full transition-colors",
                  isPast
                    ? "bg-[color:var(--glass-accent-deep)]"
                    : "bg-[color:var(--glass-ink-line)]",
                )}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 1 — situation

interface StepSituationProps {
  situations: WizardSituation[];
  selected: string | null;
  onSelect: (value: string) => void;
  onStart: () => void;
}

function StepSituation({
  situations,
  selected,
  onSelect,
  onStart,
}: StepSituationProps) {
  const t = useTranslations("public.dossier");
  const tc = useTranslations("public.dossierContent");
  return (
    <div className="space-y-4 transition-opacity duration-200">
      <div className="space-y-1.5">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[color:var(--glass-ink-faint)]">
          {t("wizardQuestion1")}
        </p>
        <Label className="block text-[16px] font-semibold text-[color:var(--glass-ink)]">
          {t("wizardSituationQuestion")}
        </Label>
        <p className="text-xs text-muted-foreground">
          {t("wizardSituationHelp")}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {situations.map((s) => {
          const Icon = resolveIcon(s.icon);
          const isSelected = selected === s.value;
          return (
            <button
              key={s.value}
              type="button"
              onClick={() => onSelect(s.value)}
              aria-pressed={isSelected}
              className={cn(
                "group flex items-center gap-3 rounded-2xl border bg-[color:var(--glass-surface)] px-3 py-3 text-left text-sm transition-all",
                "hover:-translate-y-px hover:border-[color:var(--glass-accent-a)]/40 hover:shadow-sm",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--glass-accent-a)]/40",
                isSelected
                  ? "border-[color:var(--glass-accent-a)] ring-1 ring-[color:var(--glass-accent-a)]/30"
                  : "border-[color:var(--glass-border)]",
              )}
            >
              <span
                className={cn(
                  "flex size-10 shrink-0 items-center justify-center rounded-xl transition-colors",
                  isSelected
                    ? "bg-[color:var(--glass-accent-a)] text-white"
                    : "bg-muted text-muted-foreground group-hover:bg-[color:var(--glass-accent-a)]/10 group-hover:text-[color:var(--glass-accent-a)]",
                )}
                aria-hidden
              >
                <Icon className="size-[18px]" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-[color:var(--glass-ink)]">
                  {resolveText(tc, s.labelKey, s.label)}
                </span>
                {(s.description || s.descriptionKey) ? (
                  <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                    {resolveText(tc, s.descriptionKey, s.description ?? "")}
                  </span>
                ) : null}
              </span>
              <ChevronRight
                className={cn(
                  "size-4 shrink-0 text-muted-foreground transition-transform",
                  isSelected && "translate-x-0.5 text-[color:var(--glass-accent-a)]",
                )}
                aria-hidden
              />
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-[color:var(--glass-ink-line)] pt-4">
        <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <Lock className="size-3.5" aria-hidden />
          {t("wizardAnswerConfidential")}
        </p>
        <Button onClick={onStart} variant={selected ? "default" : "outline"}>
          {t("continue")}
          <ArrowRight className="size-4" aria-hidden />
        </Button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 2 — sub-question

interface StepSubQuestionProps {
  situationLabel: string;
  subQuestion: NonNullable<WizardSituation["subQuestion"]>;
  selected: string | null;
  onSelect: (value: string) => void;
  onBack: () => void;
}

function StepSubQuestion({
  situationLabel,
  subQuestion,
  selected,
  onSelect,
  onBack,
}: StepSubQuestionProps) {
  const t = useTranslations("public.dossier");
  const tc = useTranslations("public.dossierContent");
  const subQuestionText = resolveText(tc, subQuestion.questionKey, subQuestion.question);
  const subHelpText = resolveText(tc, subQuestion.helpTextKey, subQuestion.helpText ?? "");
  return (
    <div className="space-y-4 transition-opacity duration-200">
      <div className="space-y-1.5">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {situationLabel}
        </p>
        <Label className="text-sm font-medium">{subQuestionText}</Label>
        {subHelpText && (
          <p className="rounded-md border-l-2 border-[color:var(--glass-accent-a)]/45 bg-[color:var(--glass-accent-a)]/8 px-2.5 py-1.5 text-xs text-[color:var(--glass-ink-soft)]">
            {subHelpText}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-2">
        {subQuestion.options.map((opt) => {
          const isSelected = selected === opt.value;
          const optLabel = resolveText(tc, opt.labelKey, opt.label);
          const optHelp = resolveText(tc, opt.helpTextKey, opt.helpText ?? "");
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onSelect(opt.value)}
              aria-pressed={isSelected}
              className={cn(
                "group flex items-center gap-3 rounded-2xl border bg-[color:var(--glass-surface)] px-3 py-3 text-left text-sm transition-all",
                "hover:-translate-y-px hover:border-[color:var(--glass-accent-a)]/40 hover:shadow-sm",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--glass-accent-a)]/40",
                isSelected
                  ? "border-[color:var(--glass-accent-a)] ring-1 ring-[color:var(--glass-accent-a)]/30"
                  : "border-[color:var(--glass-border)]",
              )}
            >
              <span className="flex-1">
                <span className="block font-medium">{optLabel}</span>
                {optHelp && (
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {optHelp}
                  </span>
                )}
              </span>
              <ChevronRight
                className={cn(
                  "size-4 shrink-0 text-muted-foreground transition-transform",
                  isSelected && "translate-x-0.5 text-[color:var(--glass-accent-a)]",
                )}
                aria-hidden
              />
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between pt-1">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="size-4" aria-hidden />
          {t("previous")}
        </Button>
        <p className="text-xs text-muted-foreground">
          {t("wizardClickAnswerHint")}
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 3 — refine (raffinement optionnel)

interface StepRefineProps {
  subOptionLabel: string;
  refineQuestion: NonNullable<WizardSubOption["refineQuestion"]>;
  selected: string | null;
  onSelect: (value: string) => void;
  onBack: () => void;
}

function StepRefine({
  subOptionLabel,
  refineQuestion,
  selected,
  onSelect,
  onBack,
}: StepRefineProps) {
  const t = useTranslations("public.dossier");
  const tc = useTranslations("public.dossierContent");
  const refineQuestionText = resolveText(tc, refineQuestion.questionKey, refineQuestion.question);
  const refineHelpText = resolveText(tc, refineQuestion.helpTextKey, refineQuestion.helpText ?? "");
  return (
    <div className="space-y-4 transition-opacity duration-200">
      <div className="space-y-1.5">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {subOptionLabel}
        </p>
        <Label className="text-sm font-medium">{refineQuestionText}</Label>
        {refineHelpText && (
          <p className="rounded-md border-l-2 border-[color:var(--glass-accent-a)]/45 bg-[color:var(--glass-accent-a)]/8 px-2.5 py-1.5 text-xs text-[color:var(--glass-ink-soft)]">
            {refineHelpText}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-2">
        {refineQuestion.options.map((opt) => {
          const isSelected = selected === opt.value;
          const optLabel = resolveText(tc, opt.labelKey, opt.label);
          const optHelp = resolveText(tc, opt.helpTextKey, opt.helpText ?? "");
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onSelect(opt.value)}
              aria-pressed={isSelected}
              className={cn(
                "group flex items-center gap-3 rounded-2xl border bg-[color:var(--glass-surface)] px-3 py-3 text-left text-sm transition-all",
                "hover:-translate-y-px hover:border-[color:var(--glass-accent-a)]/40 hover:shadow-sm",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--glass-accent-a)]/40",
                isSelected
                  ? "border-[color:var(--glass-accent-a)] ring-1 ring-[color:var(--glass-accent-a)]/30"
                  : "border-[color:var(--glass-border)]",
              )}
            >
              <span className="flex-1">
                <span className="block font-medium">{optLabel}</span>
                {optHelp && (
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {optHelp}
                  </span>
                )}
              </span>
              <ChevronRight
                className={cn(
                  "size-4 shrink-0 text-muted-foreground transition-transform",
                  isSelected && "translate-x-0.5 text-[color:var(--glass-accent-a)]",
                )}
                aria-hidden
              />
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between pt-1">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="size-4" aria-hidden />
          {t("previous")}
        </Button>
        <p className="text-xs text-muted-foreground">
          {t("wizardRefineHint")}
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 4 — result

const MATCH_BADGE_KEYS: Record<MatchLevel, string> = {
  recommande: "wizardMatchRecommande",
  pertinent: "wizardMatchPertinent",
  a_verifier: "wizardMatchAVerifier",
};

function MatchBadge({ level }: { level: MatchLevel }) {
  const t = useTranslations("public.dossier");
  return (
    <span className="inline-flex shrink-0 items-center rounded-full bg-[color:var(--glass-accent-a)]/15 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-[color:var(--glass-accent-a)]">
      {t(MATCH_BADGE_KEYS[level] as Parameters<typeof t>[0])}
    </span>
  );
}

function MetaChips({ dossier }: { dossier: DerivedDossier }) {
  const t = useTranslations("public.dossier");
  if (!dossier.organism && dossier.estimatedTime == null) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {dossier.organism && (
        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
          <Building2 className="size-3" aria-hidden /> {dossier.organism}
        </span>
      )}
      {dossier.estimatedTime != null && (
        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
          <Clock className="size-3" aria-hidden /> {t("wizardEstMinutes", { minutes: dossier.estimatedTime })}
        </span>
      )}
    </div>
  );
}

function BulletList({
  icon: Icon,
  title,
  items,
  tone,
}: {
  icon: LucideIcon;
  title: string;
  items: string[];
  tone: "neutral" | "warn";
}) {
  if (items.length === 0) return null;
  return (
    <div className="space-y-1">
      <p
        className={cn(
          "flex items-center gap-1.5 text-xs font-semibold",
          tone === "warn"
            ? "text-amber-700 dark:text-amber-300"
            : "text-[color:var(--glass-ink-soft)]",
        )}
      >
        <Icon className="size-3.5" aria-hidden /> {title}
      </p>
      <ul className="ml-1 space-y-0.5">
        {items.map((it) => (
          <li key={it} className="flex gap-1.5 text-xs text-muted-foreground">
            <span aria-hidden className="select-none">
              •
            </span>
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PrimaryAvailable({
  primary,
  result,
  onReset,
}: {
  primary: DerivedDossier;
  result: WizardResult;
  onReset: () => void;
}) {
  const t = useTranslations("public.dossier");
  const tc = useTranslations("public.dossierContent");
  const dryRun = useDryRun();
  const title = resolveText(tc, result.dossierTitleKey, primary.title);
  const rationale = resolveText(tc, result.rationaleKey, primary.rationale);
  const nextStepText = result.nextStepKey
    ? resolveText(tc, result.nextStepKey, primary.nextStep ?? "")
    : primary.nextStep;
  return (
    <div className="space-y-3 rounded-2xl border border-[color:var(--glass-accent-a)]/30 bg-[color:var(--glass-accent-a)]/5 p-4">
      <div className="flex items-start gap-2">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[color:var(--glass-accent-a)] text-white">
          <Sparkles className="size-4" aria-hidden />
        </span>
        <div className="flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-medium uppercase tracking-wide text-[color:var(--glass-accent-a)]">
              {t("wizardRecommendedDossier")}
            </p>
            <MatchBadge level={primary.matchLevel} />
          </div>
          <h3 className="text-base font-semibold">{title}</h3>
          <p className="text-sm text-muted-foreground">{rationale}</p>
          <MetaChips dossier={primary} />
        </div>
      </div>

      <NextStep text={nextStepText} />

      <BulletList
        icon={FileText}
        title={t("wizardDocsToPrepare")}
        items={primary.requiredDocuments}
        tone="neutral"
      />
      <BulletList
        icon={AlertTriangle}
        title={t("wizardPointsOfAttention")}
        items={primary.points}
        tone="warn"
      />

      {/* Estimation indicative — ne se rend que pour les dossiers dont le revenu
          est une allocation proportionnelle au salaire (early-return null sinon). */}
      {result.allocationEstimate && <AllocationEstimateBlock result={result} />}

      <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:items-center sm:justify-end">
        <Button variant="outline" onClick={onReset}>
          <RotateCcw className="size-4" aria-hidden />
          {t("wizardRestartGuide")}
        </Button>
        {dryRun ? (
          <Button disabled title={t("wizardNavDisabledTest")}>
            {t("wizardStartProcedure")}
            <ArrowRight className="size-4" aria-hidden />
          </Button>
        ) : (
          <>
            {/* En savoir plus → vue « Documents du parcours » (page explicative)
                sans ouverture automatique du formulaire. */}
            <Button variant="outline" render={<Link href={`/d/${primary.slug}`} />}>
              {t("learnMore")}
            </Button>
            {/* Démarrer → ouverture directe du formulaire principal (opt-in
                `?demarrer=1`) : on saute la liste intermédiaire. */}
            <Button
              render={
                <Link
                  href={`/d/${primary.slug}?demarrer=1`}
                  onClick={() =>
                    trackBundleEventClient("bundle_opened", {
                      bundleId: primary.slug ?? undefined,
                      metadata: { from: "wizard" },
                    })
                  }
                />
              }
            >
              {t("wizardStartProcedure")}
              <ArrowRight className="size-4" aria-hidden />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

function PrimaryUnavailable({
  primary,
  result,
  onReset,
}: {
  primary: DerivedDossier;
  result: WizardResult;
  onReset: () => void;
}) {
  const t = useTranslations("public.dossier");
  const tc = useTranslations("public.dossierContent");
  const dryRun = useDryRun();
  const title = resolveText(tc, result.dossierTitleKey, primary.title);
  const rationale = resolveText(tc, result.rationaleKey, primary.rationale);
  const nextStepText = result.nextStepKey
    ? resolveText(tc, result.nextStepKey, primary.nextStep ?? "")
    : primary.nextStep;
  return (
    <div className="space-y-3 rounded-2xl border border-amber-500/30 bg-amber-50/60 p-4 dark:bg-amber-950/20">
      <div className="flex items-start gap-2">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white">
          <Construction className="size-4" aria-hidden />
        </span>
        <div className="flex-1 space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-amber-900 dark:text-amber-200">
            {t("wizardComingSoon")}
          </p>
          <h3 className="text-base font-semibold">{title}</h3>
          <p className="text-sm text-amber-900/80 dark:text-amber-100/80">
            {rationale}{" "}
            {t.rich("wizardUnavailableInfo", {
              link: (chunks) => (
                <Link href="/contact" className="underline">
                  {chunks}
                </Link>
              ),
            })}
          </p>
        </div>
      </div>

      <NextStep text={nextStepText} />

      <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:items-center sm:justify-end">
        <Button variant="outline" onClick={onReset}>
          <RotateCcw className="size-4" aria-hidden />
          {t("wizardRestartGuide")}
        </Button>
        {dryRun ? (
          <Button disabled title={t("wizardNavDisabledTest")}>
            {t("wizardContactService")}
            <ArrowRight className="size-4" aria-hidden />
          </Button>
        ) : (
          <Button render={<Link href="/contact" />}>
            {t("wizardContactService")}
            <ArrowRight className="size-4" aria-hidden />
          </Button>
        )}
      </div>
    </div>
  );
}

/// Encadré « étape suivante » non engageante (affiché sous le résultat).
function NextStep({ text }: { text: string | null }) {
  const t = useTranslations("public.dossier");
  if (!text) return null;
  return (
    <div className="flex items-start gap-2 rounded-lg border border-[color:var(--glass-ink-line)] bg-[color:var(--glass-surface)] px-3 py-2">
      <ArrowRight
        className="mt-0.5 size-3.5 shrink-0 text-[color:var(--glass-accent-deep)]"
        aria-hidden
      />
      <p className="text-xs text-[color:var(--glass-ink-soft)]">
        <span className="font-semibold">{t("wizardNextStep")} </span>
        {text}
      </p>
    </div>
  );
}

/// Résultat d'ORIENTATION EXTERNE (mutuelle, pension, service régional…) :
/// pas un dossier Docbel → carte de contact dédiée, aucun lien /d/.
function PrimaryExternal({
  primary,
  result,
  onReset,
}: {
  primary: DerivedDossier;
  result: WizardResult;
  onReset: () => void;
}) {
  const t = useTranslations("public.dossier");
  const tc = useTranslations("public.dossierContent");
  const dryRun = useDryRun();
  const title = resolveText(tc, result.dossierTitleKey, primary.title);
  const rationale = resolveText(tc, result.rationaleKey, primary.rationale);
  const nextStepText = result.nextStepKey
    ? resolveText(tc, result.nextStepKey, primary.nextStep ?? "")
    : primary.nextStep;
  return (
    <div className="space-y-3 rounded-2xl border border-sky-500/30 bg-sky-50/60 p-4 dark:bg-sky-950/20">
      <div className="flex items-start gap-2">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-sky-500 text-white">
          <Building2 className="size-4" aria-hidden />
        </span>
        <div className="flex-1 space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-sky-900 dark:text-sky-200">
            {t("wizardOrientation")}
          </p>
          <h3 className="text-base font-semibold">{title}</h3>
          <p className="text-sm text-sky-900/80 dark:text-sky-100/80">
            {rationale}
          </p>
        </div>
      </div>

      <NextStep text={nextStepText} />

      <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:items-center sm:justify-end">
        <Button variant="outline" onClick={onReset}>
          <RotateCcw className="size-4" aria-hidden />
          {t("wizardRestartGuide")}
        </Button>
        {dryRun ? (
          <Button disabled title={t("wizardNavDisabledTest")}>
            {t("wizardSeeUsefulContacts")}
            <ArrowRight className="size-4" aria-hidden />
          </Button>
        ) : (
          <Button render={<Link href="/contact" />}>
            {t("wizardSeeUsefulContacts")}
            <ArrowRight className="size-4" aria-hidden />
          </Button>
        )}
      </div>
    </div>
  );
}

function RelatedCard({ dossier }: { dossier: DerivedDossier }) {
  const t = useTranslations("public.dossier");
  const dryRun = useDryRun();
  return (
    <div className="flex items-center gap-3 rounded-xl border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h4 className="truncate text-sm font-semibold text-[color:var(--glass-ink)]">
            {dossier.title}
          </h4>
          <MatchBadge level={dossier.matchLevel} />
        </div>
        {dossier.organism && (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {dossier.organism}
          </p>
        )}
      </div>
      {dossier.slug && dryRun && (
        <Button variant="outline" disabled title={t("wizardNavDisabledTest")}>
          {t("wizardOpenDossier")}
          <ArrowRight className="size-3.5" aria-hidden />
        </Button>
      )}
      {dossier.slug && !dryRun && (
        <Button
          variant="outline"
          render={
            <Link
              href={`/d/${dossier.slug}`}
              onClick={() =>
                trackBundleEventClient("bundle_opened", {
                  bundleId: dossier.slug ?? undefined,
                  metadata: { from: "wizard_related" },
                })
              }
            />
          }
        >
          {t("wizardOpenDossier")}
          <ArrowRight className="size-3.5" aria-hidden />
        </Button>
      )}
    </div>
  );
}

interface StepResultsProps {
  result: WizardResult;
  catalog: WizardCatalog;
  onBack: () => void;
  onReset: () => void;
}

function StepResults({ result, catalog, onBack, onReset }: StepResultsProps) {
  const t = useTranslations("public.dossier");
  const { primary, related } = deriveWizardResults(result, catalog);

  return (
    <div className="space-y-4 transition-opacity duration-200">
      {primary.availability === "orientation_externe" ? (
        <PrimaryExternal primary={primary} result={result} onReset={onReset} />
      ) : primary.available ? (
        <PrimaryAvailable primary={primary} result={result} onReset={onReset} />
      ) : (
        <PrimaryUnavailable primary={primary} result={result} onReset={onReset} />
      )}

      {related.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--glass-ink-faint)]">
            {t("wizardRelatedDossiers")}
          </p>
          <div className="grid gap-2">
            {related.map((d) => (
              <RelatedCard key={d.slug ?? d.title} dossier={d} />
            ))}
          </div>
        </div>
      )}

      <ResultFooter primary={primary} />

      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="size-4" aria-hidden />
          {t("previous")}
        </Button>
        <Button variant="ghost" onClick={onReset}>
          <RotateCcw className="size-4" aria-hidden />
          {t("restart")}
        </Button>
      </div>
    </div>
  );
}

/// Pied de résultat : sources officielles + date de vérification + rappel que
/// le guide n'est pas un calculateur de droits. Renforce la confiance.
function ResultFooter({ primary }: { primary: DerivedDossier }) {
  const t = useTranslations("public.dossier");
  const hasSources = primary.officialSources.length > 0;
  return (
    <div className="space-y-2 border-t border-[color:var(--glass-ink-line)] pt-3">
      {hasSources && (
        <div className="space-y-1">
          <p className="text-[11px] font-bold uppercase tracking-wide text-[color:var(--glass-ink-faint)]">
            {t("wizardOfficialSources")}
          </p>
          <ul className="space-y-0.5">
            {primary.officialSources.map((s) => (
              <li key={s.url}>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1 text-xs text-[color:var(--glass-accent-deep)] underline-offset-2 hover:underline"
                >
                  <ExternalLink className="size-3 shrink-0" aria-hidden />
                  {s.title}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="text-[11px] leading-snug text-[color:var(--glass-ink-faint)]">
        {primary.lastVerifiedAt
          ? t("wizardVerifiedOn", { date: formatFrDate(primary.lastVerifiedAt) })
          : ""}
        {t("wizardFooterDisclaimer")}
      </p>
    </div>
  );
}

function formatFrDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("fr-BE", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return "";
  }
}
