"use client";

import Link from "next/link";
import { TemporaryClosureNotice } from "./temporary-closure-notice";
import { useState } from "react";
import { FeuilleDeRoutePanel } from "./feuille-de-route-panel";
import type { OpCode } from "@/lib/feuille-de-route/model";
import { useTranslations } from "next-intl";
import { FileText, Download, ArrowRight, CircleHelp } from "lucide-react";
import { BundleWarnings } from "./onboarding/bundle-warnings";
import { parseBundleWarnings } from "@/lib/bundles/types";
import { isStagingTestPersistenceEnabled } from "@/lib/public-access";
import { BundleWorkflowRunner } from "./bundle-workflow-runner";
import { parseEligibilityQuestions, type EligibilityAnswers } from "@/lib/bundles/eligibility";
import { describeCondition, type CollectedPayloads } from "@/lib/bundles/conditions";
import { computeItemStatuses, itemTitle, itemDescription, type BundleItem } from "./bundle-runner/compute";
import type { DemandeSummary } from "@/lib/bundles/demande-summary";

export interface Bundle {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  color: string;
  items: BundleItem[];
  /// Raw JSON depuis la base — sera parsé avec `parseEligibilityQuestions` etc.
  eligibilityQuestions?: unknown;
  warnings?: unknown;
}

/// Document obligatoire au dossier mais NON remplissable par le citoyen :
/// l'employeur, l'ONEM ou un autre tiers doit le produire. Affiché dans une
/// carte séparée du parcours, à titre d'aide-mémoire.
export interface ExternalDocument {
  slug: string;
  title: string;
  issuer: string;
  required: boolean;
  responsibility: "employer" | "onem" | "external";
  responsibilityNote: string | null;
  responsibilityUrl: string | null;
}

export interface BundleRunnerProps {
  bundle: Bundle;
  availableFormSlugs?: string[];
  runId: string | null;
  resumeCode: string | null;
  resumeCodeExpiresAt: string | null;
  resumeEmail: string | null;
  eligibilityAnswers: EligibilityAnswers;
  completedTemplateIds: string[];
  payloads: CollectedPayloads;
  templateNames: Record<string, string>;
  fieldLabels: Record<string, string>;
  /// Si le dossier est piloté par un module de code, contient la liste des
  /// slugs des documents applicables aux réponses d'orientation actuelles.
  /// `null` = pas de filtrage par module (dossier piloté par config DB).
  applicableSlugs?: string[] | null;
  /// Documents obligatoires au dossier mais à charge d'un tiers (employeur,
  /// ONEM, mutuelle…). Listés à part — pas de bouton « Compléter ».
  externalDocuments?: ExternalDocument[];
  /// Email de la session connectée (pré-remplissage du dialogue d'envoi).
  userEmail?: string | null;
  /// Ids des questions de pré-qual pré-remplies depuis l'orientation (badge).
  orientationAnswerIds?: string[];
  /// Ouverture directe du formulaire principal (parcours guidé / reprise).
  /// Quand `true` et qu'il n'y a rien à décider (pré-qualification faite,
  /// aucun document encore complété), le runner saute la liste « Documents du
  /// parcours » et ouvre directement le document à remplir. Opt-in via
  /// `?demarrer=1` — la liste reste la vue par défaut (accès direct).
  autoStart?: boolean;
  /// Date ISO de la demande reprise quand cette demande a été créée par clone
  /// (« Nouvelle demande »). Affiche une alerte informative en tête. `null` =
  /// pas de clone.
  clonedFromDate?: string | null;
  /// Résumés des démarches du même dossier (sélecteur du rail si ≥ 2).
  demandes?: DemandeSummary[];
}


/** V1 public consultation. The same document applicability engine is retained.
 * Existing run data is passed only by the route after its ownership guard.
 * No creation, mutation, code email or persistent form action is exposed here.
 */
function ConsultationBundleRunner({ bundle, runId, eligibilityAnswers, completedTemplateIds, payloads, templateNames, fieldLabels, applicableSlugs, externalDocuments = [], availableFormSlugs = [] }: BundleRunnerProps) {
  const t = useTranslations("public.dossier");
  const d = useTranslations("public.design");
  const [op, setOp] = useState<OpCode | null>(null);
  const { visibleItems, allRequiredDone } = computeItemStatuses(bundle.items, completedTemplateIds, payloads, applicableSlugs);
  const questions = parseEligibilityQuestions(bundle.eligibilityQuestions);
  const available = new Set(availableFormSlugs);
  return <section className="flex w-full flex-col gap-6">
    <header><h1 className="text-3xl font-semibold leading-tight tracking-tight">{bundle.name}</h1>{bundle.description ? <p className="mt-3 leading-relaxed text-muted-foreground">{bundle.description}</p> : null}</header>
    <p className="font-semibold">{d(runId ? "oldReadOnly" : "ephemeralTitle")}</p>
    <TemporaryClosureNotice kind={runId ? "existing" : "dossier"} compact={Boolean(runId)} />
    <BundleWarnings warnings={parseBundleWarnings(bundle.warnings)} />
    {Object.keys(eligibilityAnswers).length > 0 ? <section className="glass-surface p-5"><h2 className="text-lg font-semibold">{d("recordedAnswers")}</h2><dl className="mt-4 grid gap-4">{questions.flatMap(question => {
      const value = eligibilityAnswers[question.id];
      if (value === undefined || value === "") return [];
      const label = question.type === "select" ? question.options.find(option => option.value === value)?.label ?? value : value === "true" ? t("yes") : value === "false" ? t("no") : value;
      return <div key={question.id}><dt className="font-medium">{question.label}</dt><dd className="mt-1 text-muted-foreground">{label}</dd></div>;
    })}</dl></section> : null}
    <section id="documents-disponibles" className="flex flex-col gap-4">
      <h2 className="text-xl font-semibold">{t("runnerFlowDocuments")}</h2>
      {visibleItems.map(({item,completed,eligibility}) => {
        const form=item.pdfForm;
        const canOpen=!!form && available.has(form.slug);
        const href=form ? `/document/${encodeURIComponent(form.slug)}${runId ? `?bundleRun=${encodeURIComponent(runId)}&bundleSlug=${encodeURIComponent(bundle.slug)}` : ""}` : null;
        return <article key={item.id} className="glass-surface flex flex-col items-start gap-4 p-5 sm:flex-row">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><FileText className="size-5" aria-hidden /></span>
          <div className="min-w-0 flex-1"><h3 className="font-semibold">{itemTitle(item)}</h3>{itemDescription(item) ? <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{itemDescription(item)}</p> : null}
            {form?.issuer ? <p className="mt-2 text-xs text-muted-foreground">{form.issuer}</p> : null}
            {item.condition ? <p className="mt-2 text-sm text-muted-foreground">{t("runnerConditionLabel")} {describeCondition(item.condition,templateNames,fieldLabels)}</p> : null}
            {eligibility === "pending" ? <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground"><CircleHelp className="size-4 shrink-0" aria-hidden />{d("conditionPending")}</p> : null}
            {runId && form && !canOpen && payloads[form.id] ? <details className="mt-3 rounded-xl border p-4"><summary className="min-h-11 cursor-pointer font-semibold">{d("consultAnswers")}</summary><dl className="grid gap-3 pt-3">{Object.entries(payloads[form.id]).map(([key,value]) => <div key={key}><dt className="text-sm font-semibold">{fieldLabels[`${form.id}::${key}`] ?? key}</dt><dd className="mt-1 break-words text-sm text-muted-foreground">{typeof value === "object" ? JSON.stringify(value) : String(value ?? "")}</dd></div>)}</dl></details> : null}
            <div className="mt-4 flex flex-wrap gap-3">
              {canOpen && href ? <Link href={href} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold">{d(runId ? "consultAnswers" : "standaloneForm")}<ArrowRight className="size-4 rtl:rotate-180" aria-hidden /></Link> : null}
              {runId && allRequiredDone && completed && form ? <a href={`/api/bundles/runs/${encodeURIComponent(runId)}/download/${encodeURIComponent(form.id)}`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground"><Download className="size-4" aria-hidden />{t("roadmapDownloadOne")}</a> : null}
            </div>
          </div>
        </article>;
      })}
    </section>
    {externalDocuments.length ? <section className="glass-surface p-5"><h2 className="text-xl font-semibold">{d("otherDocuments")}</h2><ul className="mt-4 grid gap-4">{externalDocuments.map(document => <li key={document.slug}><h3 className="font-semibold">{document.title}</h3><p className="mt-1 text-sm text-muted-foreground">{document.issuer}</p>{document.responsibilityNote ? <p className="mt-2 text-sm leading-relaxed">{document.responsibilityNote}</p> : null}{document.responsibilityUrl ? <a href={document.responsibilityUrl} className="inline-flex min-h-11 items-center text-sm text-primary underline">{d("sourceInformation")}</a> : null}</li>)}</ul></section> : null}
    {runId && allRequiredDone ? <section id="recuperer-envoyer" className="glass-surface p-5"><h2 className="text-xl font-semibold">{t("roadmapStepSend")}</h2><p className="mt-2 text-sm text-muted-foreground">{t("roadmapStepSendBody")}</p><FeuilleDeRoutePanel documents={visibleItems.flatMap(({item,completed}) => completed && item.pdfForm ? [{slug:item.pdfForm.slug,title:itemTitle(item),href:`/document/${encodeURIComponent(item.pdfForm.slug)}?bundleRun=${encodeURIComponent(runId)}`,pdfFormId:item.pdfForm.id}] : [])} bundleRunId={runId} op={op} onOpChange={setOp} /></section> : null}
    {runId && !allRequiredDone ? <p className="rounded-xl border p-4 text-sm text-muted-foreground">{d("downloadIncomplete")}</p> : null}
    <p className="text-sm leading-relaxed text-muted-foreground">{d("preparedNotSent")}</p>
  </section>;
}

/** Staging opts into the existing dossier workflow; production keeps the V1 consultation view. */
export function BundleRunner(props: BundleRunnerProps) {
  if (isStagingTestPersistenceEnabled()) {
    return <BundleWorkflowRunner {...props} />;
  }
  return <ConsultationBundleRunner {...props} />;
}
