"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  HelpCircle,
  Info,
  XCircle,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
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
  initialAnswers?: EligibilityAnswers;
  onAnswersChange?: (answers: EligibilityAnswers) => void;
  onContinue: (answers: EligibilityAnswers, result: EligibilityResult) => void;
  continueLabel?: string;
  orientationAnswerIds?: string[];
}

function allQuestionsCoveredByOrientation(
  questions: EligibilityQuestion[],
  answers: EligibilityAnswers,
  fromOrientation: Set<string>,
): boolean {
  const visible = questions.filter((question) =>
    evaluateVisibleIf(question.visibleIf, answers),
  );
  if (visible.length === 0) return false;
  return visible.every((question) => {
    const value = answers[question.id];
    return (
      value !== undefined &&
      value !== "" &&
      fromOrientation.has(question.id)
    );
  });
}

/** Prequalification informative : elle n'empeche jamais de poursuivre. */
export function EligibilityPrequalifier({
  questions,
  initialAnswers = {},
  onAnswersChange,
  onContinue,
  continueLabel,
  orientationAnswerIds = [],
}: Props) {
  const t = useTranslations("public.dossier");
  const [answers, setAnswers] =
    useState<EligibilityAnswers>(initialAnswers);
  const resolvedContinueLabel = continueLabel ?? t("continue");
  const fromOrientation = new Set(orientationAnswerIds);

  const result = useMemo(
    () => evaluateEligibility(questions, answers),
    [questions, answers],
  );
  const [autoSkip] = useState(() =>
    allQuestionsCoveredByOrientation(
      questions,
      initialAnswers,
      fromOrientation,
    ),
  );
  const [manuallyReopened, setManuallyReopened] = useState(false);
  const showBanner = autoSkip && !manuallyReopened;
  const autoSkipSubmittedRef = useRef(false);

  useEffect(() => {
    if (!autoSkip || autoSkipSubmittedRef.current) return;
    autoSkipSubmittedRef.current = true;
    onContinue(answers, result);
    // L'auto-skip est fige au premier rendu et protege par le ref.
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

  if (showBanner) {
    return (
      <Alert
        role="status"
        data-tone="info"
        className="border-[color:var(--info-border)] bg-[color:var(--info-subtle)] text-[color:var(--info-subtle-foreground)]"
      >
        <CheckCircle2 aria-hidden />
        <AlertDescription className="flex flex-col items-start gap-2 text-current sm:flex-row sm:items-center sm:justify-between">
          <span>{t("prequalOrientationReused")}</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setManuallyReopened(true)}
          >
            {t("prequalEditAnswers")}
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HelpCircle aria-hidden />
          {t("prequalTitle")}
        </CardTitle>
        <CardDescription>{t("prequalIntro")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <FieldGroup>
          {questions.map((question) => {
            if (!evaluateVisibleIf(question.visibleIf, answers)) return null;

            const answered =
              answers[question.id] !== undefined &&
              answers[question.id] !== "";
            const value = answers[question.id] ?? "";

            return (
              <Field
                key={question.id}
                className={cn(
                  "rounded-2xl border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] p-3 transition-colors motion-reduce:transition-none",
                  answered &&
                    "border-[color:var(--success-border)] bg-[color:var(--success-subtle)]",
                )}
                data-answer-state={answered ? "answered" : "empty"}
              >
                <FieldLabel
                  htmlFor={`q-${question.id}`}
                  className="flex flex-wrap items-center gap-2"
                >
                  {question.label}
                  {fromOrientation.has(question.id) ? (
                    <Badge
                      variant="outline"
                      className="border-[color:var(--info-border)] bg-[color:var(--info-subtle)] text-[color:var(--info-subtle-foreground)]"
                    >
                      d&apos;après vos réponses
                    </Badge>
                  ) : null}
                </FieldLabel>

                {question.helpText ? (
                  <Alert
                    role="status"
                    className="border-[color:var(--info-border)] bg-[color:var(--info-subtle)] text-[color:var(--info-subtle-foreground)]"
                  >
                    <Info aria-hidden />
                    <AlertDescription className="text-current">
                      {question.helpText}
                      {question.helpUrl ? (
                        <>
                          {" "}
                          <a
                            href={question.helpUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {t("prequalMoreInfo")}
                          </a>
                        </>
                      ) : null}
                    </AlertDescription>
                  </Alert>
                ) : null}

                <div className="flex w-full items-center gap-2 md:max-w-sm">
                  {question.type === "boolean" ? (
                    <Select
                      value={value}
                      onValueChange={(nextValue) =>
                        setAnswer(question.id, nextValue ?? "")
                      }
                    >
                      <SelectTrigger id={`q-${question.id}`} className="flex-1">
                        <SelectValue placeholder={t("prequalChooseAnswer")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value="true">{t("yes")}</SelectItem>
                          <SelectItem value="false">{t("no")}</SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Select
                      value={value}
                      onValueChange={(nextValue) =>
                        setAnswer(question.id, nextValue ?? "")
                      }
                    >
                      <SelectTrigger id={`q-${question.id}`} className="flex-1">
                        <SelectValue placeholder={t("prequalChooseAnswer")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {question.options.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  )}

                  {answered ? (
                    <span
                      className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[color:var(--success-subtle)] text-[color:var(--success)]"
                      aria-hidden
                    >
                      <CheckCircle2 className="size-5" />
                    </span>
                  ) : null}
                </div>
              </Field>
            );
          })}
        </FieldGroup>

        {result.answered > 0 ? (
          <Alert
            variant={showsIneligibleWarning ? "destructive" : "default"}
            role={showsIneligibleWarning ? "alert" : "status"}
            className={cn(
              result.verdict === "eligible" &&
                "border-[color:var(--info-border)] bg-[color:var(--info-subtle)] text-[color:var(--info-subtle-foreground)]",
              (result.verdict === "neutral" ||
                result.verdict === "unanswered") &&
                "border-[color:var(--attention-border)] bg-[color:var(--attention-subtle)] text-[color:var(--attention-subtle-foreground)]",
            )}
          >
            {result.verdict === "eligible" ? <Info aria-hidden /> : null}
            {result.verdict === "ineligible" ? <XCircle aria-hidden /> : null}
            {result.verdict === "neutral" ||
            result.verdict === "unanswered" ? (
              <AlertTriangle aria-hidden />
            ) : null}
            <AlertTitle>{verdictInfo.title}</AlertTitle>
            <AlertDescription className="text-current/80">
              {t("prequalVerdictDisclaimer")}
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:items-center sm:justify-end">
          {!allAnswered ? (
            <p className="me-auto text-xs text-muted-foreground">
              {t("prequalAnsweredCount", {
                answered: result.answered,
                total: result.total,
              })}
            </p>
          ) : null}
          <Button
            onClick={() => onContinue(answers, result)}
            variant={showsIneligibleWarning ? "outline" : "default"}
          >
            {showsIneligibleWarning
              ? t("prequalContinueAnyway")
              : resolvedContinueLabel}
            <ChevronRight
              data-icon="inline-end"
              className="rtl:rotate-180"
              aria-hidden
            />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
