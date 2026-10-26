"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ArrowRight, Download, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EligibilityPrequalifier } from "@/components/docbel/onboarding/eligibility-prequalifier";
import { ResumeCodeBanner } from "@/components/docbel/onboarding/resume-code-banner";
import { parseEligibilityQuestions, type EligibilityAnswers } from "@/lib/bundles/eligibility";
import { computeItemStatuses, itemDescription, itemTitle, resolveTargetForm } from "@/components/docbel/bundle-runner/compute";
import { describeCondition } from "@/lib/bundles/conditions";
import { parseBundleWarnings } from "@/lib/bundles/types";
import { BundleWarnings } from "@/components/docbel/onboarding/bundle-warnings";
import type { BundleRunnerProps } from "@/components/docbel/bundle-runner";

/**
 * Reuses the existing prequalification and BundleRun API for isolated staging
 * recipes. The production renderer remains the consultation-only V1 component.
 */
export function BundleWorkflowRunner({
  bundle,
  availableFormSlugs = [],
  runId: initialRunId,
  resumeCode: initialResumeCode,
  resumeCodeExpiresAt: initialResumeCodeExpiresAt,
  resumeEmail,
  eligibilityAnswers: initialEligibilityAnswers,
  completedTemplateIds,
  payloads,
  templateNames,
  fieldLabels,
  applicableSlugs,
  externalDocuments = [],
  autoStart = false,
}: BundleRunnerProps) {
  const t = useTranslations("public.dossier");
  const d = useTranslations("public.design");
  const router = useRouter();
  const [runId, setRunId] = useState<string | null>(initialRunId);
  const [resumeCode, setResumeCode] = useState<string | null>(initialResumeCode);
  const [resumeCodeExpiresAt, setResumeCodeExpiresAt] = useState<string | null>(initialResumeCodeExpiresAt);
  const [answers, setAnswers] = useState<EligibilityAnswers>(initialEligibilityAnswers);
  const [starting, setStarting] = useState(false);
  const createdHere = useRef(false);
  const autoStartAttempted = useRef(false);
  const autoForwardedRun = useRef<string | null>(null);
  const questions = parseEligibilityQuestions(bundle.eligibilityQuestions);
  const available = new Set(availableFormSlugs);
  const { visibleItems, allRequiredDone } = computeItemStatuses(
    bundle.items,
    completedTemplateIds,
    payloads,
    applicableSlugs,
  );
  const target = resolveTargetForm(visibleItems);
  const targetSlug = target?.pdfForm?.slug;
  const canOpenTarget = Boolean(targetSlug && available.has(targetSlug));

  const ensureRun = useCallback(async (nextAnswers: EligibilityAnswers): Promise<string | null> => {
    if (runId) return runId;
    setStarting(true);
    try {
      const response = await fetch(`/api/documents/bundles/${encodeURIComponent(bundle.id)}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eligibilityAnswers: nextAnswers }),
      });
      const data = await response.json().catch(() => null) as {
        id?: string;
        resumeCode?: string;
        resumeCodeExpiresAt?: string;
        error?: string;
      } | null;
      if (!response.ok || !data?.id) throw new Error(data?.error || t("runnerStartError"));
      createdHere.current = true;
      setRunId(data.id);
      if (data.resumeCode) setResumeCode(data.resumeCode);
      if (data.resumeCodeExpiresAt) setResumeCodeExpiresAt(data.resumeCodeExpiresAt);
      router.refresh();
      return data.id;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("runnerStartError"));
      return null;
    } finally {
      setStarting(false);
    }
  }, [bundle.id, router, runId, t]);

  const openForm = useCallback((slug: string, id: string) => {
    router.push(`/document/${encodeURIComponent(slug)}?bundleRun=${encodeURIComponent(id)}&bundleSlug=${encodeURIComponent(bundle.slug)}`);
  }, [bundle.slug, router]);

  const handleContinue = useCallback(async (nextAnswers: EligibilityAnswers) => {
    setAnswers(nextAnswers);
    await ensureRun(nextAnswers);
  }, [ensureRun]);

  const handleOpen = useCallback(async (slug: string) => {
    // First create the run and render its one-time resume code on this page.
    // Navigation is offered as a link only after the code is visible.
    if (!runId) {
      await ensureRun(answers);
      return;
    }
    openForm(slug, runId);
  }, [answers, ensureRun, openForm, runId]);

  useEffect(() => {
    if (!autoStart || runId || questions.length > 0 || starting || autoStartAttempted.current) return;
    autoStartAttempted.current = true;
    void ensureRun(answers);
  }, [answers, autoStart, ensureRun, questions.length, runId, starting]);

  useEffect(() => {
    if (!autoStart || createdHere.current || !initialRunId || !runId || !targetSlug || !canOpenTarget || autoForwardedRun.current === runId) return;
    autoForwardedRun.current = runId;
    openForm(targetSlug, runId);
  }, [autoStart, canOpenTarget, initialRunId, openForm, runId, targetSlug]);

  const showPrequalification = !runId && questions.length > 0;

  return (
    <section className="flex w-full flex-col gap-6">
      <header>
        <h1 className="text-3xl font-semibold leading-tight tracking-tight">{bundle.name}</h1>
        {bundle.description ? <p className="mt-3 leading-relaxed text-muted-foreground">{bundle.description}</p> : null}
      </header>
      <BundleWarnings warnings={parseBundleWarnings(bundle.warnings)} />
      {showPrequalification ? (
        <EligibilityPrequalifier
          questions={questions}
          initialAnswers={answers}
          onAnswersChange={setAnswers}
          onContinue={handleContinue}
          continueLabel={t("runnerStartFlow")}
        />
      ) : null}
      {runId && resumeCode ? (
        <ResumeCodeBanner
          runId={runId}
          resumeCode={resumeCode}
          resumeCodeExpiresAt={resumeCodeExpiresAt}
          initialResumeEmail={resumeEmail}
        />
      ) : null}
      {!showPrequalification ? (
        <section id="documents-disponibles" className="flex flex-col gap-4">
          <h2 className="text-xl font-semibold">{t("runnerFlowDocuments")}</h2>
          {visibleItems.map(({ item, completed, eligibility }) => {
            const form = item.pdfForm;
            const canOpen = Boolean(form && available.has(form.slug));
            const href = form && runId && canOpen && eligibility !== "pending"
              ? `/document/${encodeURIComponent(form.slug)}?bundleRun=${encodeURIComponent(runId)}&bundleSlug=${encodeURIComponent(bundle.slug)}`
              : null;
            return (
              <article key={item.id} className="glass-surface flex flex-col items-start gap-4 p-5 sm:flex-row">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><FileText className="size-5" aria-hidden /></span>
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold">{itemTitle(item)}</h3>
                  {itemDescription(item) ? <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{itemDescription(item)}</p> : null}
                  {item.condition ? <p className="mt-2 text-sm text-muted-foreground">{t("runnerConditionLabel")} {describeCondition(item.condition, templateNames, fieldLabels)}</p> : null}
                  {eligibility === "pending" ? <p className="mt-2 text-sm text-muted-foreground">{d("conditionPending")}</p> : null}
                  <div className="mt-4 flex flex-wrap gap-3">
                    {canOpen && href ? (
                      <Button variant="outline" render={<a href={href} />} nativeButton={false}>
                        {completed ? d("consultAnswers") : t("edit")}<ArrowRight data-icon="inline-end" aria-hidden />
                      </Button>
                    ) : canOpen && form ? (
                      <Button onClick={() => void handleOpen(form.slug)} disabled={starting || eligibility === "pending"}>
                        {starting ? t("runnerStarting") : t("complete")}<ArrowRight data-icon="inline-end" aria-hidden />
                      </Button>
                    ) : null}
                    {runId && allRequiredDone && completed && form ? (
                      <Button variant="outline" render={<a href={`/api/bundles/runs/${encodeURIComponent(runId)}/download/${encodeURIComponent(form.id)}`} />} nativeButton={false}>
                        <Download data-icon="inline-start" aria-hidden />{t("roadmapDownloadOne")}
                      </Button>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })}
          {allRequiredDone ? <p className="rounded-xl border p-4 text-sm text-muted-foreground">{d("preparedNotSent")}</p> : null}
          {externalDocuments.length > 0 ? <p className="text-sm text-muted-foreground">{t("runnerExternalDocsNote")}</p> : null}
        </section>
      ) : null}
    </section>
  );
}
