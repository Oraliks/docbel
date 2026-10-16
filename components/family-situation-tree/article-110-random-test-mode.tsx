"use client";

import { useState } from "react";
import { ClipboardCopy, Dices } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { C1BaremeThresholds } from "@/lib/baremes/c1-thresholds";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/i18n/format";
import { article110RandomChoiceMatches, type Article110RandomChoice } from "@/lib/regulatory-decision/article-110-random-comparison";
import { pickArticle110RandomCase, type Article110RandomCase } from "@/lib/regulatory-decision/article-110-random-cases";
import { presentArticle110RandomInput, type Article110RandomMessage } from "@/lib/regulatory-decision/article-110-random-presentation";

type Feedback = "conform" | "fix" | "uncertain";
type CategoryChoice = Article110RandomChoice;

function feedbackLabel(feedback: Feedback, t: ReturnType<typeof useTranslations>) {
  return feedback === "conform" ? t("article110RandomFeedbackConform") : feedback === "fix" ? t("article110RandomFeedbackFix") : t("article110RandomFeedbackUncertain");
}

function messageText(t: ReturnType<typeof useTranslations>, message: Article110RandomMessage) {
  const relation = message.relationKey ? t(message.relationKey as never) : undefined;
  const person = message.person ? t("article110RandomPersonInline", { relation: t(message.person.relationKey as never), index: message.person.index }) : undefined;
  const values = { ...message.values, ...(relation ? { relation } : {}), ...(person ? { person } : {}) };
  return t(message.key as never, values as never);
}

function FactSection({ title, facts, t }: { title: string; facts: Article110RandomMessage[]; t: ReturnType<typeof useTranslations> }) {
  if (facts.length === 0) return null;
  return <section><h3 className="text-sm font-medium">{title}</h3><ul className="mt-1 space-y-1 text-sm text-muted-foreground">{facts.map((fact, index) => <li key={`${fact.key}-${index}`}>{messageText(t, fact)}</li>)}</ul></section>;
}

export function Article110RandomTestMode({ thresholds, canLoad, onLoad }: { thresholds: C1BaremeThresholds; canLoad: (scenario: Article110RandomCase) => boolean; onLoad: (scenario: Article110RandomCase) => void }) {
  const t = useTranslations("public.pro");
  const locale = useLocale();
  const [scenario, setScenario] = useState<Article110RandomCase>();
  const [choice, setChoice] = useState<CategoryChoice>();
  const [compared, setCompared] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>();
  const [copied, setCopied] = useState(false);
  const choose = () => {
    setScenario(pickArticle110RandomCase(thresholds, Math.random, canLoad));
    setChoice(undefined);
    setCompared(false);
    setFeedback(undefined);
    setCopied(false);
  };
  const presentation = scenario ? presentArticle110RandomInput(scenario.input, locale) : undefined;
  const copyReport = async () => {
    if (!scenario || !presentation || !navigator.clipboard || !compared) return;
    const visibleFacts = [...presentation.family, ...presentation.incomes, ...presentation.particulars].map((fact) => `- ${messageText(t, fact)}`).join("\n");
    const report = [
      `${t("article110RandomScenario")}: ${scenario.id}`,
      `${t("article110RandomDate")}: ${formatDate(scenario.assessmentDate, locale)}`,
      `${t("article110RandomFacts")}:\n${visibleFacts}`,
      `${t("article110RandomYourChoice")}: ${choice ? t(`article110RandomChoice${choice === "insufficient" ? "Insufficient" : choice}` as never) : "—"}`,
      `${t("article110RandomResult")}: ${scenario.result.category ?? t("article110RandomResultUndetermined")}`,
      `${t("article110RandomReason")}: ${scenario.result.reason}`,
      `${t("article110RandomRules")}: ${scenario.result.householdAssessment.sourceRuleIds.join(", ") || "—"}`,
      `${t("article110RandomTechnicalInput")}: ${JSON.stringify(scenario.input, null, 2)}`,
      `${t("article110RandomFeedback")}: ${feedback ? feedbackLabel(feedback, t) : t("article110RandomFeedbackNone")}`,
    ].join("\n");
    await navigator.clipboard.writeText(report);
    setCopied(true);
  };

  if (!scenario) return <Button type="button" variant="outline" size="sm" onClick={choose}><Dices className="size-4" />{t("article110RandomStart")}</Button>;

  const loadable = canLoad(scenario);
  const result = scenario.result.category ?? "insufficient";
  const choices: CategoryChoice[] = ["A", "N", "B", "insufficient"];
  return <Card className="border-dashed"><CardHeader><CardTitle className="flex items-center gap-2"><Dices className="size-5" />{t("article110RandomTitle")}</CardTitle><CardDescription>{t("article110RandomQuestion")}</CardDescription></CardHeader><CardContent className="space-y-4"><dl className="text-sm"><dt className="text-muted-foreground">{t("article110RandomDate")}</dt><dd>{formatDate(scenario.assessmentDate, locale)}</dd></dl><FactSection title={t("article110RandomFamilySituation")} facts={presentation!.family} t={t} /><FactSection title={t("article110RandomIncomeFacts")} facts={presentation!.incomes} t={t} /><FactSection title={t("article110RandomParticularFacts")} facts={presentation!.particulars} t={t} />{presentation!.incomplete ? <p className="rounded-md bg-muted p-3 text-sm">{t("article110RandomIncompleteFacts")}</p> : null}<div><p className="mb-2 text-sm font-medium">{t("article110RandomQuestion")}</p><div className="flex flex-wrap gap-2">{choices.map((value) => <Button key={value} type="button" variant={choice === value ? "default" : "outline"} size="sm" onClick={() => { setChoice(value); setCompared(false); setFeedback(undefined); }}>{t(`article110RandomChoice${value === "insufficient" ? "Insufficient" : value}` as never)}</Button>)}</div></div><div className="flex flex-wrap gap-2"><Button type="button" onClick={() => setCompared(true)} disabled={!choice}>{t("article110RandomCompare")}</Button><Button type="button" variant="outline" onClick={choose}>{t("article110RandomAnother")}</Button></div>{compared ? <><dl className="grid gap-2 text-sm sm:grid-cols-2"><div><dt className="text-muted-foreground">{t("article110RandomYourChoice")}</dt><dd>{choice ? t(`article110RandomChoice${choice === "insufficient" ? "Insufficient" : choice}` as never) : "—"}</dd></div><div><dt className="text-muted-foreground">{t("article110RandomResult")}</dt><dd>{t(`article110RandomChoice${result === "insufficient" ? "Insufficient" : result}` as never)}</dd></div></dl><p className="rounded-md bg-muted p-3 text-sm">{choice && article110RandomChoiceMatches(choice, scenario.result.category) ? t("article110RandomChoiceMatches") : t("article110RandomChoiceDiffers")}</p><div><p className="text-sm font-medium">{t("article110RandomReason")}</p><p className="text-sm text-muted-foreground">{scenario.result.reason}</p></div>{scenario.result.missingFacts.length > 0 ? <div><p className="text-sm font-medium">{t("article110RandomMissingFacts")}</p><ul className="mt-1 space-y-1 text-sm text-muted-foreground">{scenario.result.missingFacts.map((fact) => <li key={fact.factKey}>{fact.label}</li>)}</ul></div> : null}<p className="rounded-md bg-muted p-3 text-sm">{t("article110RandomManual")}</p><div className="flex flex-wrap gap-2">{loadable ? <Button type="button" onClick={() => onLoad(scenario)}>{t("article110RandomLoad")}</Button> : <span className="self-center text-sm text-muted-foreground">{t("article110RandomIncompatible")}</span>}<Button type="button" variant="outline" onClick={copyReport}><ClipboardCopy className="size-4" />{copied ? t("article110RandomCopied") : t("article110RandomCopy")}</Button></div><div><p className="mb-2 text-sm font-medium">{t("article110RandomFeedback")}</p><div className="flex flex-wrap gap-2">{(["conform", "fix", "uncertain"] as const).map((value) => <Button key={value} type="button" variant={feedback === value ? "default" : "outline"} size="sm" onClick={() => setFeedback(value)}>{feedbackLabel(value, t)}</Button>)}</div></div></> : null}<details className="rounded-md border p-3 text-sm"><summary className="cursor-pointer font-medium">{t("article110RandomTechnicalDetails")}</summary><div className="mt-3 space-y-3"><p>{t("article110RandomTechnicalScenario", { id: scenario.id })}</p><div><p className="font-medium">{t("article110RandomTechnicalInput")}</p><pre className="mt-1 overflow-x-auto rounded-md bg-muted p-3 text-xs">{JSON.stringify(scenario.input, null, 2)}</pre></div>{compared ? <><div><p className="font-medium">{t("article110RandomRules")}</p><p className="text-muted-foreground">{scenario.result.householdAssessment.sourceRuleIds.join(", ") || "—"}</p></div><div><p className="font-medium">{t("article110RandomTechnicalMatrixFacts")}</p><pre className="mt-1 overflow-x-auto rounded-md bg-muted p-3 text-xs">{JSON.stringify(scenario.facts, null, 2)}</pre></div></> : null}</div></details></CardContent></Card>;
}
