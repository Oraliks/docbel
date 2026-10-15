"use client";

import { useState } from "react";
import { Dices, ClipboardCopy } from "lucide-react";
import { useTranslations } from "next-intl";
import type { C1BaremeThresholds } from "@/lib/baremes/c1-thresholds";
import { pickArticle110RandomCase, type Article110RandomCase } from "@/lib/regulatory-decision/article-110-random-cases";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Feedback = "conform" | "fix" | "uncertain";

function feedbackLabel(feedback: Feedback, t: ReturnType<typeof useTranslations>) {
  return feedback === "conform" ? t("article110RandomFeedbackConform") : feedback === "fix" ? t("article110RandomFeedbackFix") : t("article110RandomFeedbackUncertain");
}

export function Article110RandomTestMode({
  thresholds,
  canLoad,
  onLoad,
}: {
  thresholds: C1BaremeThresholds;
  canLoad: (scenario: Article110RandomCase) => boolean;
  onLoad: (scenario: Article110RandomCase) => void;
}) {
  const t = useTranslations("public.pro");
  const [scenario, setScenario] = useState<Article110RandomCase>();
  const [feedback, setFeedback] = useState<Feedback>();
  const [copied, setCopied] = useState(false);
  const choose = () => {
    setScenario(pickArticle110RandomCase(thresholds));
    setFeedback(undefined);
    setCopied(false);
  };
  const copyReport = async () => {
    if (!scenario || !navigator.clipboard) return;
    const report = [
      `${t("article110RandomScenario")}: ${scenario.label} (${scenario.id})`,
      `${t("article110RandomDate")}: ${scenario.assessmentDate}`,
      `${t("article110RandomFacts")}: ${JSON.stringify(scenario.facts, null, 2)}`,
      `${t("article110RandomResult")}: ${scenario.result.category ?? t("article110RandomResultUndetermined")}`,
      `${t("article110RandomReason")}: ${scenario.result.reason}`,
      `${t("article110RandomRules")}: ${scenario.result.householdAssessment.sourceRuleIds.join(", ") || "—"}`,
      `${t("article110RandomFeedback")}: ${feedback ? feedbackLabel(feedback, t) : t("article110RandomFeedbackNone")}`,
    ].join("\n");
    await navigator.clipboard.writeText(report);
    setCopied(true);
  };

  if (!scenario) return <Button type="button" variant="outline" size="sm" onClick={choose}><Dices className="size-4" />{t("article110RandomStart")}</Button>;
  const loadable = canLoad(scenario);
  return <Card className="border-dashed"><CardHeader><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle className="flex items-center gap-2"><Dices className="size-5" />{t("article110RandomTitle")}</CardTitle><CardDescription>{scenario.label}</CardDescription></div><Badge variant="secondary">{scenario.id}</Badge></div></CardHeader><CardContent className="space-y-4"><dl className="grid gap-2 text-sm sm:grid-cols-2"><div><dt className="text-muted-foreground">{t("article110RandomDate")}</dt><dd>{scenario.assessmentDate}</dd></div><div><dt className="text-muted-foreground">{t("article110RandomResult")}</dt><dd>{scenario.result.category ?? t("article110RandomResultUndetermined")}</dd></div></dl><div><p className="text-sm font-medium">{t("article110RandomFacts")}</p><pre className="mt-1 overflow-x-auto rounded-md bg-muted p-3 text-xs">{JSON.stringify(scenario.facts, null, 2)}</pre></div><div><p className="text-sm font-medium">{t("article110RandomReason")}</p><p className="text-sm text-muted-foreground">{scenario.result.reason}</p></div><div><p className="text-sm font-medium">{t("article110RandomRules")}</p><p className="text-sm text-muted-foreground">{scenario.result.householdAssessment.sourceRuleIds.join(", ") || "—"}</p></div><p className="rounded-md bg-muted p-3 text-sm">{t("article110RandomManual")}</p><div className="flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={choose}>{t("article110RandomAnother")}</Button>{loadable ? <Button type="button" onClick={() => onLoad(scenario)}>{t("article110RandomLoad")}</Button> : <span className="self-center text-sm text-muted-foreground">{t("article110RandomIncompatible")}</span>}<Button type="button" variant="outline" onClick={copyReport}><ClipboardCopy className="size-4" />{copied ? t("article110RandomCopied") : t("article110RandomCopy")}</Button></div><div><p className="mb-2 text-sm font-medium">{t("article110RandomFeedback")}</p><div className="flex flex-wrap gap-2">{(["conform", "fix", "uncertain"] as const).map((value) => <Button key={value} type="button" variant={feedback === value ? "default" : "outline"} size="sm" onClick={() => setFeedback(value)}>{feedbackLabel(value, t)}</Button>)}</div></div></CardContent></Card>;
}
