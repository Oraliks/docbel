"use client";

import { useMemo, useState } from "react";
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
}

/// Pré-qualification informative affichée AVANT le parcours.
///
/// **Principe non-négociable :** le résultat est purement informatif. Même
/// en verdict "non éligible", on permet "Continuer quand même" — beldoc ne
/// décide pas à la place des administrations.
export function EligibilityPrequalifier({
  questions,
  initialAnswers = {},
  onAnswersChange,
  onContinue,
  continueLabel,
}: Props) {
  const t = useTranslations("public.dossier");
  const [answers, setAnswers] = useState<EligibilityAnswers>(initialAnswers);
  const resolvedContinueLabel = continueLabel ?? t("continue");

  const result = useMemo(
    () => evaluateEligibility(questions, answers),
    [questions, answers]
  );

  function setAnswer(questionId: string, value: string) {
    const next = { ...answers, [questionId]: value };
    setAnswers(next);
    onAnswersChange?.(next);
  }

  const verdictInfo = verdictMessageFr(result.verdict);
  const allAnswered = result.answered === result.total && result.total > 0;
  const showsIneligibleWarning = result.verdict === "ineligible";

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
            <Label htmlFor={`q-${q.id}`} className="text-sm font-medium">
              {q.label}
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
