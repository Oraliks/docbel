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

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Accessibility,
  ArrowLeft,
  ArrowRight,
  Briefcase,
  Check,
  ChevronRight,
  Construction,
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

interface Props {
  situations: WizardSituation[];
}

type StepNumber = 1 | 2 | 3 | 4;

const STEP_LABELS: Record<StepNumber, string> = {
  1: "Votre situation",
  2: "Vos besoins",
  3: "Affinons",
  4: "Résultat",
};

export function DossierWizard({ situations }: Props) {
  const [currentStep, setCurrentStep] = useState<StepNumber>(1);
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
    setSelectedSituation(value);
    setSelectedSubOption(null);
    setSelectedRefine(null);
    // Pas de sous-question → résultat direct (step 4). Sinon step 2.
    setCurrentStep(next.subQuestion ? 2 : 4);
  }

  function handleSubOptionSelect(value: string) {
    setSelectedSubOption(value);
    setSelectedRefine(null);
    const opt = situation?.subQuestion?.options.find((o) => o.value === value);
    // Si la sous-option raffine encore → step 3. Sinon → résultat (step 4).
    setCurrentStep(opt?.refineQuestion ? 3 : 4);
  }

  function handleRefineSelect(value: string) {
    setSelectedRefine(value);
    setCurrentStep(4);
  }

  function handleStartGuide() {
    // GARDE-FOU CRITIQUE : sans sélection, on REFUSE d'avancer. Pas de
    // défaut implicite vers chômage temporaire.
    if (!selectedSituation) {
      toast.error("Choisissez d'abord votre situation pour qu'on puisse vous guider.");
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
    setCurrentStep(1);
    setSelectedSituation(null);
    setSelectedSubOption(null);
    setSelectedRefine(null);
  }

  return (
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
              L&apos;assistant dossier
            </span>
            <span className="text-xs font-normal text-muted-foreground">
              Répondez à quelques questions pour trouver le bon dossier.
            </span>
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <Stepper currentStep={currentStep} />

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
            situationLabel={situation.label}
            subQuestion={situation.subQuestion}
            selected={selectedSubOption}
            onSelect={handleSubOptionSelect}
            onBack={handleBack}
          />
        )}

        {currentStep === 3 && subOption?.refineQuestion && (
          <StepRefine
            subOptionLabel={subOption.label}
            refineQuestion={subOption.refineQuestion}
            selected={selectedRefine}
            onSelect={handleRefineSelect}
            onBack={handleBack}
          />
        )}

        {currentStep === 4 && result && (
          <StepResult
            result={result}
            onBack={handleBack}
            onReset={handleReset}
          />
        )}
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Stepper

interface StepperProps {
  currentStep: StepNumber;
}

function Stepper({ currentStep }: StepperProps) {
  const steps: StepNumber[] = [1, 2, 3, 4];
  return (
    <ol
      className="flex items-center gap-2"
      aria-label="Progression du guide"
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
              {STEP_LABELS[step]}
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
  return (
    <div className="space-y-4 transition-opacity duration-200">
      <div className="space-y-1.5">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[color:var(--glass-ink-faint)]">
          Question 1 sur 4
        </p>
        <Label className="block text-[16px] font-semibold text-[color:var(--glass-ink)]">
          Quelle est votre situation actuelle ?
        </Label>
        <p className="text-xs text-muted-foreground">
          Choisissez la situation qui vous correspond le mieux.
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
                  {s.label}
                </span>
                {s.description ? (
                  <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                    {s.description}
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
          Votre réponse est confidentielle
        </p>
        <Button onClick={onStart} variant={selected ? "default" : "outline"}>
          Continuer
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
  return (
    <div className="space-y-4 transition-opacity duration-200">
      <div className="space-y-1.5">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {situationLabel}
        </p>
        <Label className="text-sm font-medium">{subQuestion.question}</Label>
        {subQuestion.helpText && (
          <p className="rounded-md border-l-2 border-[color:var(--glass-accent-a)]/45 bg-[color:var(--glass-accent-a)]/8 px-2.5 py-1.5 text-xs text-[color:var(--glass-ink-soft)]">
            {subQuestion.helpText}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-2">
        {subQuestion.options.map((opt) => {
          const isSelected = selected === opt.value;
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
                <span className="block font-medium">{opt.label}</span>
                {opt.helpText && (
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {opt.helpText}
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
          Précédent
        </Button>
        <p className="text-xs text-muted-foreground">
          Cliquez sur une réponse pour voir le dossier recommandé.
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
  return (
    <div className="space-y-4 transition-opacity duration-200">
      <div className="space-y-1.5">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {subOptionLabel}
        </p>
        <Label className="text-sm font-medium">{refineQuestion.question}</Label>
        {refineQuestion.helpText && (
          <p className="rounded-md border-l-2 border-[color:var(--glass-accent-a)]/45 bg-[color:var(--glass-accent-a)]/8 px-2.5 py-1.5 text-xs text-[color:var(--glass-ink-soft)]">
            {refineQuestion.helpText}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-2">
        {refineQuestion.options.map((opt) => {
          const isSelected = selected === opt.value;
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
                <span className="block font-medium">{opt.label}</span>
                {opt.helpText && (
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {opt.helpText}
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
          Précédent
        </Button>
        <p className="text-xs text-muted-foreground">
          Encore une précision pour vous orienter au mieux.
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 4 — result

interface StepResultProps {
  result: WizardResult;
  onBack: () => void;
  onReset: () => void;
}

function StepResult({ result, onBack, onReset }: StepResultProps) {
  const isAvailable = result.dossierSlug !== null;
  return (
    <div className="space-y-4 transition-opacity duration-200">
      {isAvailable ? (
        <div className="space-y-3 rounded-2xl border border-[color:var(--glass-accent-a)]/30 bg-[color:var(--glass-accent-a)]/5 p-4">
          <div className="flex items-start gap-2">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[color:var(--glass-accent-a)] text-white">
              <Sparkles className="size-4" aria-hidden />
            </span>
            <div className="flex-1 space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-[color:var(--glass-accent-a)]">
                Dossier recommandé
              </p>
              <h3 className="text-base font-semibold">{result.dossierTitle}</h3>
              <p className="text-sm text-muted-foreground">
                {result.rationale}
              </p>
            </div>
          </div>

          {/* Estimation indicative — ne se rend que pour les dossiers dont le
              revenu est une allocation proportionnelle au salaire (le bloc
              early-return null sinon). */}
          {result.allocationEstimate && (
            <AllocationEstimateBlock result={result} />
          )}

          <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:items-center sm:justify-end">
            {/* Reset du wizard (pas un Link vers /mon-dossier : on est déjà
                sur cette page, un Link soft ne réinitialiserait pas l'état
                client et ne ferait donc rien visiblement). */}
            <Button variant="outline" onClick={onReset}>
              <RotateCcw className="size-4" aria-hidden />
              Recommencer le guide
            </Button>
            <Button render={<Link href={`/d/${result.dossierSlug}`} />}>
              Commencer ce dossier
              <ArrowRight className="size-4" aria-hidden />
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3 rounded-2xl border border-amber-500/30 bg-amber-50/60 p-4 dark:bg-amber-950/20">
          <div className="flex items-start gap-2">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white">
              <Construction className="size-4" aria-hidden />
            </span>
            <div className="flex-1 space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-amber-900 dark:text-amber-200">
                Bientôt disponible
              </p>
              <h3 className="text-base font-semibold">{result.dossierTitle}</h3>
              <p className="text-sm text-amber-900/80 dark:text-amber-100/80">
                {result.rationale} Ce dossier est en construction. En attendant,
                vous pouvez contacter le service via{" "}
                <Link href="/contact" className="underline">
                  /contact
                </Link>
                .
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:items-center sm:justify-end">
            <Button variant="outline" onClick={onReset}>
              <RotateCcw className="size-4" aria-hidden />
              Recommencer le guide
            </Button>
            <Button render={<Link href="/contact" />}>
              Contacter le service
              <ArrowRight className="size-4" aria-hidden />
            </Button>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="size-4" aria-hidden />
          Précédent
        </Button>
        <Button variant="ghost" onClick={onReset}>
          <RotateCcw className="size-4" aria-hidden />
          Recommencer
        </Button>
      </div>
    </div>
  );
}
