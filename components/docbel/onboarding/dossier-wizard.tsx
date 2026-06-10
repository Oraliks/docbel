"use client";

// Orientation wizard de `/mon-dossier` (colonne gauche du mockup).
//
// Parcours guidé : « Quelle est ta situation ? » → sous-question éventuelle →
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
  RotateCcw,
  Search,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { GLASS_CARD } from "@/lib/glass-classes";
import type {
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

/// Step 3 reste désactivée tant qu'on n'a pas de logique de raffinement
/// (plusieurs dossiers à départager pour un même couple situation/sous-option).
const DISABLED_STEPS: ReadonlySet<StepNumber> = new Set<StepNumber>([3]);

export function DossierWizard({ situations }: Props) {
  const [currentStep, setCurrentStep] = useState<StepNumber>(1);
  const [selectedSituation, setSelectedSituation] = useState<string | null>(
    null,
  );
  const [selectedSubOption, setSelectedSubOption] = useState<string | null>(
    null,
  );

  const situation =
    situations.find((s) => s.value === selectedSituation) ?? null;
  const subOption: WizardSubOption | null =
    situation?.subQuestion?.options.find(
      (opt) => opt.value === selectedSubOption,
    ) ?? null;

  /// Le résultat n'est défini qu'en step 4. Provenance : option de
  /// sous-question si elle existe, sinon `result` direct sur la situation.
  const result: WizardResult | null =
    subOption?.result ?? situation?.result ?? null;

  function handleSituationSelect(value: string) {
    const next = situations.find((s) => s.value === value);
    if (!next) return;
    setSelectedSituation(value);
    setSelectedSubOption(null);
    // Si la situation n'a pas de sous-question, on saute step 2 et on va
    // directement au résultat. Sinon, étape suivante = step 2.
    if (next.subQuestion) {
      setCurrentStep(2);
    } else {
      setCurrentStep(4);
    }
  }

  function handleSubOptionSelect(value: string) {
    setSelectedSubOption(value);
    // Step 3 « Affinons » n'est pas encore activée — on saute directement
    // à step 4 (cf. commentaire en tête de fichier).
    setCurrentStep(4);
  }

  function handleStartGuide() {
    // GARDE-FOU CRITIQUE : sans sélection, on REFUSE d'avancer. Pas de
    // défaut implicite vers chômage temporaire.
    if (!selectedSituation) {
      toast.error("Choisis d'abord ta situation pour qu'on puisse te guider.");
      return;
    }
    // Re-déclenche la sélection effective (utile si l'utilisateur a cliqué
    // sur une carte puis sur « Commencer » sans avoir auto-avancé — sécurité).
    handleSituationSelect(selectedSituation);
  }

  function handleBack() {
    if (currentStep === 4) {
      // Si la situation avait une sous-question, on retourne à step 2.
      // Sinon, on retourne à step 1.
      if (situation?.subQuestion) {
        setCurrentStep(2);
        setSelectedSubOption(null);
      } else {
        setCurrentStep(1);
        setSelectedSituation(null);
      }
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
  }

  return (
    <Card className={cn(GLASS_CARD, "p-2")}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="size-4" aria-hidden />
          Trouvons ton dossier en 4 étapes
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Réponds à 1 ou 2 questions, on te propose le bon dossier — pas de
          défaut implicite, on attend ton choix.
        </p>
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
      className="flex items-center gap-1 sm:gap-2"
      aria-label="Progression du guide"
    >
      {steps.map((step, idx) => {
        const isDisabled = DISABLED_STEPS.has(step);
        const isCurrent = step === currentStep && !isDisabled;
        const isPast = step < currentStep && !isDisabled;
        const isFuture = !isCurrent && !isPast && !isDisabled;
        return (
          <li
            key={step}
            className="flex flex-1 items-center gap-1 sm:gap-2"
            aria-current={isCurrent ? "step" : undefined}
          >
            <div className="flex min-w-0 items-center gap-2">
              <span
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors",
                  isCurrent &&
                    "bg-[color:var(--glass-accent-a)] text-white ring-2 ring-[color:var(--glass-accent-a)]/30",
                  isPast &&
                    "bg-emerald-500 text-white",
                  isFuture &&
                    "bg-muted text-muted-foreground",
                  isDisabled &&
                    "bg-muted/50 text-muted-foreground/60",
                )}
                aria-hidden
              >
                {isPast ? <Check className="size-3.5" /> : step}
              </span>
              <span
                className={cn(
                  "hidden truncate text-xs font-medium sm:inline",
                  isCurrent && "text-foreground",
                  isPast && "text-foreground/80",
                  (isFuture || isDisabled) && "text-muted-foreground",
                )}
              >
                {STEP_LABELS[step]}
              </span>
            </div>
            {idx < steps.length - 1 && (
              <span
                className={cn(
                  "h-px flex-1 transition-colors",
                  step < currentStep ? "bg-emerald-500/60" : "bg-border",
                )}
                aria-hidden
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
        <Label className="text-sm font-medium">Quelle est ta situation ?</Label>
        <p className="text-xs text-muted-foreground">
          Choisis la case qui te correspond le mieux. Tu pourras revenir en
          arrière à tout moment.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
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
                  "flex size-9 shrink-0 items-center justify-center rounded-xl transition-colors",
                  isSelected
                    ? "bg-[color:var(--glass-accent-a)] text-white"
                    : "bg-muted text-muted-foreground group-hover:bg-[color:var(--glass-accent-a)]/10 group-hover:text-[color:var(--glass-accent-a)]",
                )}
                aria-hidden
              >
                <Icon className="size-4" />
              </span>
              <span className="flex-1 font-medium">{s.label}</span>
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

      <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          {selected
            ? "Situation sélectionnée — clique sur « Commencer le guide » pour continuer."
            : "Sélectionne une case ci-dessus avant de continuer."}
        </p>
        <Button onClick={onStart} variant={selected ? "default" : "outline"}>
          Commencer le guide
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
          <p className="rounded-md border-l-2 border-blue-300 bg-blue-50/60 px-2.5 py-1.5 text-xs text-blue-900 dark:border-blue-700 dark:bg-blue-950/30 dark:text-blue-200">
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
          Clique sur une réponse pour voir le dossier recommandé.
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

          <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:items-center sm:justify-end">
            <Button variant="outline" render={<Link href="/mon-dossier" />}>
              Voir d&apos;autres options
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
                tu peux contacter le service via{" "}
                <Link href="/aidez-moi" className="underline">
                  /aidez-moi
                </Link>
                .
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:items-center sm:justify-end">
            <Button variant="outline" render={<Link href="/aidez-moi" />}>
              Contacter le service
            </Button>
            <Button render={<Link href="/mon-dossier" />}>
              Voir le catalogue complet
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
