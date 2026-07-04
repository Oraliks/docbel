"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Circle,
  Clock,
  EyeOff,
  Inbox,
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
  type BundleItem,
} from "./bundle-runner/compute";

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
  /// Si vrai : n'affiche jamais la pré-qualification en écran bloquant — les
  /// questions restent visibles en ligne au-dessus des documents, qui sont
  /// toujours affichés. Cf. `DossierDefinition.inlineDocumentQuestions`.
  inlineDocumentQuestions?: boolean;
  /// Slugs des documents marqués `gatedByRestOfDossier` dans ce dossier (cf.
  /// lib/dossiers/types.ts) — transmis à `computeItemStatuses` pour calculer
  /// `ItemStatus.locked`. Vide pour tout dossier qui n'utilise pas ce champ.
  gatedSlugs?: string[];
  /// Vrai si les questions marquées `gatesDocuments` (ou, à défaut, TOUTES
  /// les questions — cf. `DossierQuestion.gatesDocuments`) ont une réponse.
  /// Remplace `eligibilityCompleted` (qui exige TOUTES les questions) comme
  /// signal passé à `computeItemStatuses` pour débloquer un document
  /// `gatedByRestOfDossier` — cf. lib/pdf-forms/generate-lock.ts (Finding 2).
  /// Défaut `true` : un dossier qui ne passe pas cette prop (ou qui ne
  /// marque aucune question `gatesDocuments`) garde le comportement actuel.
  gatingQuestionsAnswered?: boolean;
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
  inlineDocumentQuestions = false,
  gatedSlugs = [],
  gatingQuestionsAnswered = true,
}: BundleRunnerProps) {
  const t = useTranslations("public.dossier");
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

  /// Affichage de la pré-qualification :
  /// - mode "gate" (comportement historique, inchangé) : quand on n'a pas
  ///   encore démarré le run ET il y a des questions, OU quand l'utilisateur
  ///   a explicitement demandé à revoir ses réponses.
  /// - mode "en ligne" (`inlineDocumentQuestions`) : jamais de gate — les
  ///   questions et les documents sont TOUJOURS affichés ensemble.
  const showsPrequalifierGate =
    !inlineDocumentQuestions && ((!runId && hasEligibilityQuestions) || editingEligibility);
  const showsQuestions =
    showsPrequalifierGate || (inlineDocumentQuestions && hasEligibilityQuestions);
  const showsDocumentsSection =
    inlineDocumentQuestions || !showsPrequalifierGate || Boolean(runId);

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

  async function handleStart(item: BundleItem) {
    if (!item.pdfForm) return;
    const id = await ensureRun();
    if (!id) return;
    const url = `/document/${item.pdfForm.slug}?bundleRun=${encodeURIComponent(id)}&bundleSlug=${encodeURIComponent(bundle.slug)}`;
    router.push(url);
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
      title: t("runnerResetTitle"),
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
  } = computeItemStatuses(
      bundle.items,
      completedTemplateIds,
      payloads,
      applicableSlugs,
      { eligibilityAnswersComplete: gatingQuestionsAnswered, gatedSlugs },
    );

  return (
    <div className="space-y-6">
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
            <p className="text-sm text-muted-foreground">
              {t("runnerCompletedCount", {
                completed: completedCount,
                count: visibleItems.length,
              })}
            </p>
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
      {showsQuestions && (
        <EligibilityPrequalifier
          questions={eligibilityQuestions}
          initialAnswers={eligibilityAnswers}
          onAnswersChange={setEligibilityAnswers}
          onContinue={handlePrequalifierContinue}
          continueLabel={runId ? t("save") : t("runnerStartFlow")}
        />
      )}

      {/* Banner code de reprise — visible une fois le run créé */}
      {runId && resumeCode && (
        <ResumeCodeBanner
          runId={runId}
          resumeCode={resumeCode}
          resumeCodeExpiresAt={resumeCodeExpiresAt}
          initialResumeEmail={resumeEmail}
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

      {/* Documents — masqué tant que la pré-qualification n'est pas faite (mode gate) ; toujours affiché en mode inline */}
      {showsDocumentsSection && (
        <>
          {!runId && !inlineDocumentQuestions && (
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
                        },
                      ]
                    : []
              )}
              externalDocuments={externalDocuments}
              resumeCode={resumeCode}
            />
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("runnerFlowDocuments")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {visibleItems.map(({ item, completed, eligibility, locked }, idx) => {
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
                      {locked && !completed && (
                        <p className="text-[11px] text-amber-700 mt-1">
                          {t("runnerLockedHint")}
                        </p>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant={completed ? "outline" : "default"}
                      onClick={() => handleStart(item)}
                      disabled={isPending || starting || (locked && !completed)}
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
  );
}
