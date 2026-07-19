"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { toast } from "sonner";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Circle,
  Clock,
  EyeOff,
  Inbox,
  Loader2,
  Mail,
  Package,
  RefreshCw,
  Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { NouvelleDemandeButton } from "./nouvelle-demande-button";
import {
  describeCondition,
  type CollectedPayloads,
} from "@/lib/bundles/conditions";
import {
  type EligibilityAnswers,
  type EligibilityQuestion,
  parseEligibilityQuestions,
} from "@/lib/bundles/eligibility";
import { parseBundleWarnings, type BundleWarning } from "@/lib/bundles/types";
import { EligibilityPrequalifier } from "./onboarding/eligibility-prequalifier";
import { BundleWarnings } from "./onboarding/bundle-warnings";
import { ResumeCodeBanner } from "./onboarding/resume-code-banner";
import { BundleRoadmap, type RoadmapDocument } from "./bundle-roadmap";
import {
  computeItemStatuses,
  itemDescription,
  itemOrganismeLabel,
  itemTitle,
  resolveTargetForm,
  type BundleItem,
} from "./bundle-runner/compute";
import { DemarcheRail } from "./demarche-rail";
import { buildDemarcheRailModel } from "@/lib/bundles/rail-model";
import type { DemandeSummary } from "@/lib/bundles/demande-summary";

interface Bundle {
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

interface BundleRunnerProps {
  bundle: Bundle;
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

const RESPONSIBILITY_LABEL_KEYS: Record<ExternalDocument["responsibility"], string> = {
  employer: "runnerResponsibilityEmployer",
  onem: "runnerResponsibilityOnem",
  external: "runnerResponsibilityExternal",
};

export function BundleRunner({
  bundle,
  runId: initialRunId,
  resumeCode: initialResumeCode,
  resumeCodeExpiresAt: initialResumeCodeExpiresAt,
  resumeEmail,
  eligibilityAnswers: initialEligibilityAnswers,
  completedTemplateIds,
  payloads,
  templateNames,
  fieldLabels,
  applicableSlugs = null,
  externalDocuments = [],
  userEmail = null,
  orientationAnswerIds = [],
  autoStart = false,
  clonedFromDate = null,
  demandes = [],
}: BundleRunnerProps) {
  const t = useTranslations("public.dossier");
  const locale = useLocale();
  const router = useRouter();
  const confirm = useConfirm();
  const [runId, setRunId] = useState<string | null>(initialRunId);
  const [resumeCode, setResumeCode] = useState<string | null>(initialResumeCode);
  const [resumeCodeExpiresAt, setResumeCodeExpiresAt] = useState<string | null>(
    initialResumeCodeExpiresAt
  );
  const [starting, setStarting] = useState(false);
  /// Slug du document tiers dont on génère le courrier (spinner par item).
  const [generatingLetter, setGeneratingLetter] = useState<string | null>(null);
  const [eligibilityAnswers, setEligibilityAnswers] = useState<EligibilityAnswers>(
    initialEligibilityAnswers
  );
  const [editingEligibility, setEditingEligibility] = useState(false);

  const eligibilityQuestions: EligibilityQuestion[] = useMemo(
    () => parseEligibilityQuestions(bundle.eligibilityQuestions),
    [bundle.eligibilityQuestions]
  );
  const warnings: BundleWarning[] = useMemo(
    () => parseBundleWarnings(bundle.warnings),
    [bundle.warnings]
  );

  const hasEligibilityQuestions = eligibilityQuestions.length > 0;
  const eligibilityCompleted = useMemo(() => {
    if (!hasEligibilityQuestions) return true;
    return eligibilityQuestions.every(
      (q) => eligibilityAnswers[q.id] !== undefined && eligibilityAnswers[q.id] !== ""
    );
  }, [hasEligibilityQuestions, eligibilityQuestions, eligibilityAnswers]);

  /// Pré-qualification en écran bloquant : quand on n'a pas encore démarré
  /// le run ET il y a des questions, OU quand l'utilisateur a explicitement
  /// demandé à revoir ses réponses.
  const showsPrequalifierGate =
    (!runId && hasEligibilityQuestions) || editingEligibility;
  const showsDocumentsSection = !showsPrequalifierGate || Boolean(runId);

  async function ensureRun(answers?: EligibilityAnswers): Promise<string | null> {
    if (runId && !answers) return runId;
    setStarting(true);
    try {
      const res = await fetch(`/api/documents/bundles/${bundle.id}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eligibilityAnswers: answers ?? eligibilityAnswers }),
      });
      if (!res.ok) throw new Error(t("runnerStartError"));
      const run = await res.json();
      setRunId(run.id);
      if (run.resumeCode) setResumeCode(run.resumeCode);
      if (run.resumeCodeExpiresAt) setResumeCodeExpiresAt(run.resumeCodeExpiresAt);
      router.refresh();
      return run.id;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("error"));
      return null;
    } finally {
      setStarting(false);
    }
  }

  /// Ouvre le formulaire d'un document (création/reprise du run + navigation).
  /// Renvoie `true` si la navigation a été déclenchée, `false` en cas d'échec
  /// (ex. création du run impossible) — utilisé par l'auto-ouverture pour
  /// retomber sur la liste plutôt que de laisser l'utilisateur bloqué.
  async function handleStart(item: BundleItem): Promise<boolean> {
    if (!item.pdfForm) return false;
    const id = await ensureRun();
    if (!id) return false;
    const url = `/document/${item.pdfForm.slug}?bundleRun=${encodeURIComponent(id)}&bundleSlug=${encodeURIComponent(bundle.slug)}`;
    router.push(url);
    return true;
  }

  /// Génère un courrier de réclamation PDF (document à charge d'un tiers) et
  /// déclenche son téléchargement. Réservé aux responsabilités "employer" et
  /// "external" (jamais "onem").
  async function handleGenerateLetter(d: ExternalDocument) {
    if (d.responsibility === "onem") return;
    setGeneratingLetter(d.slug);
    try {
      const res = await fetch("/api/dossier/letter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          runId,
          docSlug: d.slug,
          docTitle: d.title,
          issuer: d.issuer,
          responsibility: d.responsibility,
        }),
      });
      const ct = res.headers.get("content-type") || "";
      if (!res.ok || !ct.includes("application/pdf")) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || t("runnerLetterError"));
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `courrier-${d.slug}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(t("runnerLetterSuccess"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("error"));
    } finally {
      setGeneratingLetter(null);
    }
  }

  async function handlePrequalifierContinue(answers: EligibilityAnswers) {
    setEligibilityAnswers(answers);
    if (editingEligibility && runId) {
      // Update existant
      try {
        const res = await fetch(`/api/documents/bundles/${bundle.id}/run`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ eligibilityAnswers: answers }),
        });
        if (!res.ok) throw new Error(t("runnerUpdateError"));
        toast.success(t("runnerAnswersUpdated"));
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t("error"));
      }
      setEditingEligibility(false);
      router.refresh();
    } else {
      // Premier démarrage : crée le run avec les réponses
      await ensureRun(answers);
    }
  }

  async function reset() {
    const ok = await confirm({
      title: t("runnerRestartTitle"),
      description: t("runnerResetDescription"),
      confirmText: t("restart"),
      destructive: true,
    });
    if (!ok || !runId) return;
    try {
      // Abandonne le run côté serveur (status=abandoned). Le prochain rendu
      // ne trouvera plus de run in_progress et démarrera un parcours vierge.
      const res = await fetch(`/api/bundles/runs/${encodeURIComponent(runId)}`, {
        method: "DELETE",
      });
      if (!res.ok && res.status !== 404) {
        toast.error(t("runnerResetError"));
        return;
      }
      // Reset client : on perd la référence au run abandonné, on vide les
      // réponses préliminaires affichées et on rafraîchit pour repartir
      // d'une feuille blanche côté SSR.
      setRunId(null);
      setResumeCode(null);
      setResumeCodeExpiresAt(null);
      setEligibilityAnswers({});
      setEditingEligibility(false);
      router.refresh();
      toast.success(t("runnerResetSuccess"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("error"));
    }
  }

  // Statuts des items — logique PURE extraite (cf. ./bundle-runner/compute).
  const {
    visibleItems,
    hiddenItems,
    completedCount,
    requiredVisible,
    allRequiredDone,
  } = computeItemStatuses(bundle.items, completedTemplateIds, payloads, applicableSlugs);

  // --- Auto-ouverture du formulaire principal (opt-in `?demarrer=1`) ---
  // On saute la liste « Documents du parcours » et on ouvre directement le
  // document à remplir UNIQUEMENT quand il n'y a rien à décider : la
  // pré-qualification est faite (pas de gate affiché) et aucun document n'est
  // encore complété. Dès qu'un document est validé, `completedCount > 0` et on
  // revient sur la liste (feuille de route / documents restants) — d'où
  // l'absence de chaînage de redirections après la validation d'un formulaire.
  const autoTarget = resolveTargetForm(visibleItems);
  const [autoForwardFailed, setAutoForwardFailed] = useState(false);
  const autoForwardedRef = useRef(false);
  const canAutoForward =
    autoStart &&
    !autoForwardFailed &&
    !showsPrequalifierGate &&
    !editingEligibility &&
    completedCount === 0 &&
    autoTarget !== null;

  useEffect(() => {
    if (!canAutoForward || autoForwardedRef.current || !autoTarget) return;
    autoForwardedRef.current = true;
    handleStart(autoTarget).then((ok) => {
      if (!ok) {
        // Échec (run non créé, réseau…) : on révèle la liste.
        autoForwardedRef.current = false;
        setAutoForwardFailed(true);
      }
    });
    // On ne réagit qu'au passage à `true` de canAutoForward ; le ref garantit
    // l'unicité, donc l'identité de handleStart/autoTarget (relus au moment du
    // déclenchement) n'a pas à figurer dans les deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canAutoForward]);

  // Placeholder pendant l'auto-ouverture — évite le flash de la liste avant la
  // redirection. Lien de repli vers la liste si JS/réseau ne suit pas.
  if (canAutoForward) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{t("runnerStarting")}</p>
        <a
          href={
            runId
              ? `/d/${bundle.slug}?bundleRun=${encodeURIComponent(runId)}`
              : `/d/${bundle.slug}`
          }
          className="text-xs text-primary underline underline-offset-2"
        >
          {t("runnerFlowDocuments")}
        </a>
      </div>
    );
  }

  // Modèle du rail — mêmes intrants que computeItemStatuses ci-dessus.
  const railModel = buildDemarcheRailModel({
    items: bundle.items,
    completedTemplateIds,
    payloads,
    applicableSlugs,
    hasEligibilityQuestions,
    eligibilityCompleted,
  });

  return (
    <div className="grid w-full grid-cols-1 gap-6 lg:grid-cols-[300px_minmax(0,1fr)] lg:items-start">
      <DemarcheRail
        bundleName={bundle.name}
        bundleSlug={bundle.slug}
        runId={runId}
        model={railModel}
        demandes={demandes}
        resumeSlot={
          runId && resumeCode ? (
            <ResumeCodeBanner
              runId={runId}
              resumeCode={resumeCode}
              resumeCodeExpiresAt={resumeCodeExpiresAt}
              initialResumeEmail={resumeEmail}
            />
          ) : undefined
        }
        newDemarcheSlot={
          runId ? (
            <NouvelleDemandeButton bundleId={bundle.id} slug={bundle.slug} variant="ghost" />
          ) : undefined
        }
      />
      <div className="min-w-0 space-y-6">
        {/* Alerte « demande reprise » : cette demande a été clonée d'une précédente. */}
        {clonedFromDate && (
          <Alert>
            <AlertDescription className="text-sm">
              {t("demandeClonedNotice", {
                date: new Intl.DateTimeFormat(locale, {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                }).format(new Date(clonedFromDate)),
              })}
            </AlertDescription>
          </Alert>
        )}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div
              className="w-10 h-10 rounded-md flex items-center justify-center text-white"
              style={{ backgroundColor: bundle.color }}
            >
              <Package className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold">{bundle.name}</h1>
            </div>
            {runId && completedCount > 0 && (
              <Button variant="ghost" size="sm" onClick={reset}>
                <RefreshCw className="w-4 h-4 mr-1" />
                {t("restart")}
              </Button>
            )}
          </div>
          {bundle.description && (
            <p className="text-sm text-muted-foreground">{bundle.description}</p>
          )}
        </div>

        {/* Avertissements importants — toujours en haut */}
        {warnings.length > 0 && <BundleWarnings warnings={warnings} />}

        {/* Pré-qualification — informatif, jamais bloquant */}
        {showsPrequalifierGate && (
          <EligibilityPrequalifier
            questions={eligibilityQuestions}
            initialAnswers={eligibilityAnswers}
            onAnswersChange={setEligibilityAnswers}
            orientationAnswerIds={orientationAnswerIds}
            onContinue={handlePrequalifierContinue}
            continueLabel={runId ? t("save") : t("runnerStartFlow")}
          />
        )}

        {/* Section "modifier la pré-qualification" — visible quand un run existe et qu'il y avait des questions */}
        {runId && hasEligibilityQuestions && eligibilityCompleted && !editingEligibility && (
          <div className="flex items-center justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setEditingEligibility(true)}
              className="text-xs"
            >
              <Pencil className="w-3 h-3 mr-1" />
              {t("runnerEditAnswers")}
            </Button>
          </div>
        )}

        {/* Documents — masqué tant que la pré-qualification n'est pas faite */}
        {showsDocumentsSection && (
          <>
            {!runId && (
              <Alert>
                <AlertDescription className="text-sm flex items-center justify-between gap-3 flex-wrap">
                  <span>
                    {t("runnerStartHint")}
                  </span>
                </AlertDescription>
              </Alert>
            )}

            {/* Feuille de route — l'écran de sortie, dès que tout l'obligatoire est complété */}
            {allRequiredDone && requiredVisible.length > 0 && (
              <BundleRoadmap
                documents={visibleItems.flatMap(
                  ({ item, completed }): RoadmapDocument[] =>
                    completed && item.pdfForm
                      ? [
                          {
                            slug: item.pdfForm.slug,
                            title: itemTitle(item),
                            href: `/document/${item.pdfForm.slug}?bundleRun=${encodeURIComponent(runId ?? "")}&bundleSlug=${encodeURIComponent(bundle.slug)}`,
                            pdfFormId: item.pdfForm.id,
                          },
                        ]
                      : []
                )}
                externalDocuments={externalDocuments}
                resumeCode={resumeCode}
                bundleRunId={runId}
                userEmail={userEmail}
              />
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t("runnerFlowDocuments")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {visibleItems.map(({ item, completed, eligibility }, idx) => {
                  const isPending = eligibility === "pending";
                  return (
                    <div
                      key={item.id}
                      className={`flex items-start gap-3 p-3 border rounded-md transition-colors ${
                        completed
                          ? "bg-emerald-500/10 border-emerald-500/20"
                          : isPending
                            ? "bg-white/[0.06] border-dashed opacity-70"
                            : "hover:bg-white/10"
                      }`}
                    >
                      <div className="w-8 h-8 rounded-full flex items-center justify-center font-medium text-sm flex-shrink-0">
                        {completed ? (
                          <CheckCircle2 className="w-6 h-6 text-green-600" />
                        ) : isPending ? (
                          <Clock className="w-5 h-5 text-muted-foreground" />
                        ) : (
                          <Circle className="w-5 h-5 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium">
                            {idx + 1}. {itemTitle(item)}
                          </span>
                          {(() => {
                            const org = itemOrganismeLabel(item);
                            return org ? (
                              <Badge
                                variant="outline"
                                className="text-xs"
                                style={{ borderColor: org.color, color: org.color }}
                              >
                                {org.label}
                              </Badge>
                            ) : null;
                          })()}
                          {!item.required && (
                            <Badge variant="secondary" className="text-xs">
                              {t("optional")}
                            </Badge>
                          )}
                          {item.triggered && (
                            <Badge
                              variant="outline"
                              className="text-xs border-amber-500 text-amber-700 dark:text-amber-300"
                            >
                              {t("runnerTriggeredBadge")}
                            </Badge>
                          )}
                        </div>
                        {itemDescription(item) && (
                          <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                            {itemDescription(item)}
                          </p>
                        )}
                        {item.condition && (
                          <p className="text-[11px] text-muted-foreground mt-1 italic">
                            {t("runnerConditionLabel")} {describeCondition(item.condition, templateNames, fieldLabels)}
                          </p>
                        )}
                        {isPending && (
                          <p className="text-[11px] text-amber-700 mt-1">
                            {t("runnerPendingHint")}
                          </p>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant={completed ? "outline" : "default"}
                        onClick={() => handleStart(item)}
                        disabled={isPending || starting}
                      >
                        {completed
                          ? t("edit")
                          : starting
                            ? t("runnerStarting")
                            : t("complete")}
                        {!completed && <ArrowRight className="w-4 h-4 ml-1" />}
                      </Button>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {externalDocuments.length > 0 && (
              <Card className="border-amber-500/30 bg-amber-500/5">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Inbox className="w-4 h-4 text-amber-700 dark:text-amber-300" />
                    {t("runnerExternalDocsTitle", { count: externalDocuments.length })}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t("runnerExternalDocsNote")}
                  </p>
                </CardHeader>
                <CardContent className="space-y-2">
                  {externalDocuments.map((d) => (
                    <div
                      key={d.slug}
                      className="flex items-start gap-3 p-3 border rounded-md border-amber-500/20 bg-white/[0.04]"
                    >
                      <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0">
                        <Building2 className="w-5 h-5 text-amber-700 dark:text-amber-300" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium">{d.title}</span>
                          <Badge
                            variant="outline"
                            className="text-xs border-amber-500 text-amber-700 dark:text-amber-300"
                          >
                            {t(RESPONSIBILITY_LABEL_KEYS[d.responsibility] as Parameters<typeof t>[0])}
                          </Badge>
                          {!d.required && (
                            <Badge variant="secondary" className="text-xs">
                              {t("optional")}
                            </Badge>
                          )}
                        </div>
                        {d.responsibilityNote && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {d.responsibilityNote}
                          </p>
                        )}
                        {d.responsibilityUrl && (
                          <a
                            href={d.responsibilityUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary underline underline-offset-2 mt-1 inline-block"
                          >
                            {t("runnerResponsibilityLinkLabel")}
                          </a>
                        )}
                      </div>
                      {(d.responsibility === "employer" ||
                        d.responsibility === "external") && (
                        <div className="flex-shrink-0">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleGenerateLetter(d)}
                            disabled={generatingLetter === d.slug}
                          >
                            <Mail className="w-4 h-4 mr-1" />
                            {generatingLetter === d.slug
                              ? t("runnerLetterGenerating")
                              : t("runnerGenerateLetter")}
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {hiddenItems.length > 0 && (
              <Card className="border-dashed bg-white/5">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
                    <EyeOff className="w-4 h-4" />
                    {t("runnerHiddenDocsTitle", { count: hiddenItems.length })}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1.5">
                  {hiddenItems.map(({ item }) => (
                    <div
                      key={item.id}
                      className="text-xs text-muted-foreground flex items-center gap-2"
                    >
                      <Circle className="w-3 h-3" />
                      <span>{itemTitle(item)}</span>
                      {item.condition && (
                        <span className="italic">
                          {t("runnerRequiredIf", {
                            condition: describeCondition(item.condition, templateNames, fieldLabels),
                          })}
                        </span>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}
