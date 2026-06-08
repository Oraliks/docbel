"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowRight,
  CheckCircle2,
  Circle,
  Clock,
  EyeOff,
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
  evaluateCondition,
  describeCondition,
  type BundleCondition,
  type CollectedPayloads,
} from "@/lib/bundles/conditions";
import {
  type EligibilityAnswers,
  type EligibilityQuestion,
  parseEligibilityAnswers,
  parseEligibilityQuestions,
} from "@/lib/bundles/eligibility";
import { parseBundleWarnings, type BundleWarning } from "@/lib/bundles/types";
import { EligibilityPrequalifier } from "./onboarding/eligibility-prequalifier";
import { BundleWarnings } from "./onboarding/bundle-warnings";
import { ResumeCodeBanner } from "./onboarding/resume-code-banner";

interface BundleItem {
  id: string;
  templateId: string | null;
  pdfFormId: string | null;
  order: number;
  required: boolean;
  condition: BundleCondition;
  template: null;
  pdfForm: {
    id: string;
    slug: string;
    title: string;
    description: string | null;
    issuer: string | null;
  } | null;
}

function itemSourceId(item: BundleItem): string {
  return item.pdfFormId ?? item.id;
}
function itemTitle(item: BundleItem): string {
  return item.pdfForm?.title ?? "Document";
}
function itemDescription(item: BundleItem): string | null {
  return item.pdfForm?.description ?? null;
}
function itemOrganismeLabel(item: BundleItem): { label: string; color: string } | null {
  if (item.pdfForm?.issuer) return { label: item.pdfForm.issuer, color: "#666" };
  return null;
}

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
}

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
}: BundleRunnerProps) {
  const router = useRouter();
  const confirm = useConfirm();
  const [runId, setRunId] = useState<string | null>(initialRunId);
  const [resumeCode, setResumeCode] = useState<string | null>(initialResumeCode);
  const [resumeCodeExpiresAt, setResumeCodeExpiresAt] = useState<string | null>(
    initialResumeCodeExpiresAt
  );
  const [starting, setStarting] = useState(false);
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
  /// - quand on n'a pas encore démarré le run ET il y a des questions
  /// - OU quand l'utilisateur a explicitement demandé à revoir ses réponses
  const showsPrequalifier =
    (!runId && hasEligibilityQuestions) || editingEligibility;

  async function ensureRun(answers?: EligibilityAnswers): Promise<string | null> {
    if (runId && !answers) return runId;
    setStarting(true);
    try {
      const res = await fetch(`/api/documents/bundles/${bundle.id}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eligibilityAnswers: answers ?? eligibilityAnswers }),
      });
      if (!res.ok) throw new Error("Échec démarrage parcours");
      const run = await res.json();
      setRunId(run.id);
      if (run.resumeCode) setResumeCode(run.resumeCode);
      if (run.resumeCodeExpiresAt) setResumeCodeExpiresAt(run.resumeCodeExpiresAt);
      router.refresh();
      return run.id;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
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
        if (!res.ok) throw new Error("Échec mise à jour");
        toast.success("Réponses mises à jour");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erreur");
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
      title: "Recommencer ce parcours ?",
      description:
        "Votre progression actuelle sera réinitialisée. Les documents déjà générés et téléchargés ne sont pas affectés.",
      confirmText: "Recommencer",
      destructive: true,
    });
    if (!ok || !runId) return;
    try {
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    }
  }

  // Calculer le statut de chaque item.
  // `applicableSlugs` (si fourni par un dossier codé) écrase la visibilité :
  // un item dont le slug n'est pas applicable aux réponses d'orientation est
  // caché, peu importe la condition JSON V1/V2.
  const applicableSet = applicableSlugs ? new Set(applicableSlugs) : null;
  const itemStatuses = bundle.items.map((item) => {
    const completed = completedTemplateIds.includes(itemSourceId(item));
    const slug = item.pdfForm?.slug ?? null;
    const inDossier = applicableSet === null || (slug !== null && applicableSet.has(slug));
    const conditionRes = evaluateCondition(item.condition, payloads);
    const eligibility = inDossier ? conditionRes : false;
    return { item, completed, eligibility };
  });

  const visibleItems = itemStatuses.filter(
    ({ eligibility }) => eligibility !== false
  );
  const hiddenItems = itemStatuses.filter(({ eligibility }) => eligibility === false);

  const completedCount = visibleItems.filter((s) => s.completed).length;
  const requiredVisible = visibleItems.filter(
    (s) => s.item.required && s.eligibility === true
  );
  const allRequiredDone = requiredVisible.every((s) => s.completed);

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
              {completedCount} sur {visibleItems.length} document
              {visibleItems.length !== 1 ? "s" : ""} complété
              {completedCount !== 1 ? "s" : ""}
            </p>
          </div>
          {runId && completedCount > 0 && (
            <Button variant="ghost" size="sm" onClick={reset}>
              <RefreshCw className="w-4 h-4 mr-1" />
              Recommencer
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
      {showsPrequalifier && (
        <EligibilityPrequalifier
          questions={eligibilityQuestions}
          initialAnswers={eligibilityAnswers}
          onAnswersChange={setEligibilityAnswers}
          onContinue={handlePrequalifierContinue}
          continueLabel={runId ? "Enregistrer" : "Démarrer le parcours"}
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
            Modifier mes réponses préliminaires
          </Button>
        </div>
      )}

      {/* Documents — masqué tant que la pré-qualification n'est pas faite */}
      {(!showsPrequalifier || runId) && (
        <>
          {!runId && (
            <Alert>
              <AlertDescription className="text-sm flex items-center justify-between gap-3 flex-wrap">
                <span>
                  Cliquez sur un document pour démarrer votre parcours. Les documents qui dépendent de
                  vos réponses apparaîtront au fur et à mesure.
                </span>
              </AlertDescription>
            </Alert>
          )}

          {allRequiredDone && requiredVisible.length > 0 && (
            <Alert className="bg-emerald-500/10 border-emerald-500/20">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
              <AlertDescription className="text-sm text-green-700 dark:text-green-400">
                Tous les documents obligatoires de ce parcours sont complétés.
              </AlertDescription>
            </Alert>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Documents du parcours</CardTitle>
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
                            Optionnel
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
                          Condition : {describeCondition(item.condition, templateNames, fieldLabels)}
                        </p>
                      )}
                      {isPending && (
                        <p className="text-[11px] text-amber-700 mt-1">
                          Complétez d&apos;abord les documents précédents pour savoir si celui-ci est
                          requis.
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
                        ? "Modifier"
                        : starting
                          ? "Démarrage…"
                          : "Compléter"}
                      {!completed && <ArrowRight className="w-4 h-4 ml-1" />}
                    </Button>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {hiddenItems.length > 0 && (
            <Card className="border-dashed bg-white/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
                  <EyeOff className="w-4 h-4" />
                  Documents non requis pour votre situation ({hiddenItems.length})
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
                        (requis si : {describeCondition(item.condition, templateNames, fieldLabels)})
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
