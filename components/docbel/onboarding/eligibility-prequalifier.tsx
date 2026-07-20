"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { CheckCircle2, AlertTriangle, XCircle, HelpCircle, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  type EligibilityAnswers,
  type EligibilityQuestion,
  type EligibilityResult,
  evaluateEligibility,
  evaluateVisibleIf,
  verdictMessageFr,
} from "@/lib/bundles/eligibility";

interface Props {
  questions: EligibilityQuestion[];
  /// Réponses initiales (si reprise d'un dossier).
  initialAnswers?: EligibilityAnswers;
  /// Appelé à chaque changement (parent peut persister).
  onAnswersChange?: (answers: EligibilityAnswers) => void;
  /// Appelé quand l'utilisateur clique "Continuer" (que le verdict soit positif ou non).
  onContinue: (answers: EligibilityAnswers, result: EligibilityResult) => void;
  /// Bouton "Continuer quand même" affiché en cas de verdict défavorable.
  continueLabel?: string;
  /// Questions pré-remplies depuis l'orientation → badge informatif.
  orientationAnswerIds?: string[];
}

/// Vrai si TOUTES les questions actuellement visibles (selon `answers`) sont
/// à la fois répondues ET reprises de l'orientation (wizard) — cf.
/// `orientationAnswerIds`. Sert à l'auto-skip du gate (Task 4.2) : s'il n'y a
/// aucune question visible (rien à couvrir) ou qu'au moins une n'est pas
/// couverte par l'orientation, renvoie `false` et le gate complet s'affiche
/// comme avant.
///
/// `orientationAnswerIds` n'est peuplé QUE lors du tout premier chargement,
/// sans run existant (cf. app/d/[slug]/page.tsx, bloc `if (!effectiveRun)`) :
/// dès qu'un run existe (reprise / « Modifier mes réponses préliminaires »),
/// l'appelant transmet systématiquement un tableau vide → cette fonction
/// renvoie alors `false` et l'auto-skip ne se déclenche jamais sur une
/// réédition (jamais de ré-auto-soumission en boucle).
function allQuestionsCoveredByOrientation(
  questions: EligibilityQuestion[],
  answers: EligibilityAnswers,
  fromOrientation: Set<string>,
): boolean {
  const visible = questions.filter((q) => evaluateVisibleIf(q.visibleIf, answers));
  if (visible.length === 0) return false;
  return visible.every((q) => {
    const value = answers[q.id];
    return value !== undefined && value !== "" && fromOrientation.has(q.id);
  });
}

/// Pré-qualification informative affichée AVANT le parcours.
///
/// **Principe non-négociable :** le résultat est purement informatif. Même
/// en verdict "non éligible", on permet "Continuer quand même" — beldoc ne
/// décide pas à la place des administrations.
///
/// **Auto-skip (Task 4.2) :** si l'utilisateur arrive du guichet (wizard) et
/// que l'orientation couvre déjà TOUTES les questions, on saute le gate et on
/// soumet automatiquement les réponses reprises — même chemin que le bouton
/// "Démarrer le parcours" (`onContinue`, cf. bundle-runner.tsx
/// `handlePrequalifierContinue` → POST run). Un bandeau discret remplace
/// alors le questionnaire, avec un lien pour rouvrir le gate complet.
export function EligibilityPrequalifier({
  questions,
  initialAnswers = {},
  onAnswersChange,
  onContinue,
  continueLabel,
  orientationAnswerIds = [],
}: Props) {
  const t = useTranslations("public.dossier");
  const [answers, setAnswers] = useState<EligibilityAnswers>(initialAnswers);
  const resolvedContinueLabel = continueLabel ?? t("continue");
  const fromOrientation = new Set(orientationAnswerIds);

  const result = useMemo(
    () => evaluateEligibility(questions, answers),
    [questions, answers]
  );

  // Décidé UNE SEULE FOIS via l'init paresseuse de useState (pas un effect,
  // pas de setState synchrone) : si l'utilisateur rouvre le gate ("Les
  // modifier"), il reste affiché ensuite même si les props ne changent pas.
  const [autoSkip] = useState(() =>
    allQuestionsCoveredByOrientation(questions, initialAnswers, fromOrientation)
  );
  const [manuallyReopened, setManuallyReopened] = useState(false);
  const showBanner = autoSkip && !manuallyReopened;
  const autoSkipSubmittedRef = useRef(false);

  // Auto-soumission : déclenchée par un handler async lancé depuis l'effect
  // (jamais de setState synchrone dans l'effect lui-même — pattern autorisé,
  // cf. l'auto-forward de bundle-runner.tsx l.338-352). `onContinue` est
  // typé `=> void` mais son implémentation réelle est asynchrone (POST run) :
  // on l'appelle en fire-and-forget, exactement comme le ferait un clic sur
  // "Démarrer le parcours". Le ref garantit l'unicité de l'appel (protège
  // aussi contre le double-montage du Strict Mode en dev).
  useEffect(() => {
    if (!autoSkip || autoSkipSubmittedRef.current) return;
    autoSkipSubmittedRef.current = true;
    onContinue(answers, result);
    // Ne réagit qu'au montage : `autoSkip` est figé après le premier rendu
    // (init paresseuse ci-dessus) et le ref garantit l'unicité — l'identité
    // de `answers`/`result`/`onContinue` (relus au moment du déclenchement)
    // n'a donc pas à figurer dans les deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSkip]);

  function setAnswer(questionId: string, value: string) {
    const next = { ...answers, [questionId]: value };
    setAnswers(next);
    onAnswersChange?.(next);
  }

  const verdictInfo = verdictMessageFr(result.verdict);
  const allAnswered = result.answered === result.total && result.total > 0;
  const showsIneligibleWarning = result.verdict === "ineligible";

  // Bandeau discret : remplace le gate quand l'orientation couvre déjà tout
  // (auto-skip ci-dessus). "Les modifier" rouvre le gate complet — mêmes
  // champs, déjà préremplis (badge inclus) — sans perdre les réponses.
  if (showBanner) {
    return (
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
            {t("prequalOrientationReused")}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setManuallyReopened(true)}
          >
            {t("prequalEditAnswers")}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <HelpCircle className="size-4" />
          {t("prequalTitle")}
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          {t("prequalIntro")}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {questions.map((q) => {
          // Visibilité conditionnelle : les questions dont la condition n'est
          // pas satisfaite ne sont pas affichées (et ne sont pas comptées
          // dans le verdict — cf. evaluateEligibility).
          if (!evaluateVisibleIf(q.visibleIf, answers)) return null;
          return (
          <div key={q.id} className="space-y-1.5">
            <Label
              htmlFor={`q-${q.id}`}
              className="flex flex-wrap items-center gap-2 text-sm font-medium"
            >
              {q.label}
              {fromOrientation.has(q.id) && (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-normal text-primary">
                  d&apos;après vos réponses
                </span>
              )}
            </Label>
            {q.helpText && (
              <p className="rounded-md border-l-2 border-blue-300 bg-blue-50/60 px-2.5 py-1.5 text-xs text-blue-900 dark:bg-blue-950/30 dark:text-blue-200 dark:border-blue-700">
                <span className="font-medium">💡 </span>
                {q.helpText}
                {q.helpUrl && (
                  <>
                    {" "}
                    <a
                      href={q.helpUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline"
                    >
                      {t("prequalMoreInfo")}
                    </a>
                  </>
                )}
              </p>
            )}
            {q.type === "boolean" ? (
              <Select
                value={answers[q.id] ?? ""}
                onValueChange={(v) => setAnswer(q.id, v ?? "")}
              >
                <SelectTrigger id={`q-${q.id}`} className="w-full md:w-64">
                  <SelectValue placeholder={t("prequalChooseAnswer")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">{t("yes")}</SelectItem>
                  <SelectItem value="false">{t("no")}</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <Select
                value={answers[q.id] ?? ""}
                onValueChange={(v) => setAnswer(q.id, v ?? "")}
              >
                <SelectTrigger id={`q-${q.id}`} className="w-full md:w-64">
                  <SelectValue placeholder={t("prequalChooseAnswer")} />
                </SelectTrigger>
                <SelectContent>
                  {q.options.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          );
        })}

        {/* Verdict — visible dès qu'au moins une réponse a été donnée */}
        {result.answered > 0 && (
          <div
            className={`rounded-md border p-3 text-sm flex items-start gap-2 ${
              result.verdict === "eligible"
                ? "bg-emerald-500/10 border-emerald-500/20 text-green-900 dark:text-green-200"
                : result.verdict === "ineligible"
                  ? "bg-red-500/10 border-red-500/20 text-red-900 dark:text-red-200"
                  : "bg-amber-500/10 border-amber-500/20 text-amber-900 dark:text-amber-200"
            }`}
            role="status"
          >
            {result.verdict === "eligible" && <CheckCircle2 className="size-4 mt-0.5 flex-shrink-0" />}
            {result.verdict === "ineligible" && <XCircle className="size-4 mt-0.5 flex-shrink-0" />}
            {(result.verdict === "neutral" || result.verdict === "unanswered") && (
              <AlertTriangle className="size-4 mt-0.5 flex-shrink-0" />
            )}
            <div className="flex-1">
              <p className="font-medium">{verdictInfo.title}</p>
              <p className="text-xs mt-1 opacity-80">
                {t("prequalVerdictDisclaimer")}
              </p>
            </div>
          </div>
        )}

        <div className="pt-2 flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2">
          {!allAnswered && (
            <p className="text-xs text-muted-foreground mr-auto">
              {t("prequalAnsweredCount", {
                answered: result.answered,
                total: result.total,
              })}
            </p>
          )}
          <Button
            onClick={() => onContinue(answers, result)}
            variant={showsIneligibleWarning ? "outline" : "default"}
          >
            {showsIneligibleWarning ? t("prequalContinueAnyway") : resolvedContinueLabel}
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
