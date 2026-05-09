"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowRight,
  CheckCircle2,
  Circle,
  Clock,
  EyeOff,
  Package,
  PenTool,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useConfirm } from "@/components/ui/confirm-dialog";
import {
  evaluateCondition,
  describeCondition,
  type BundleConditionRule,
  type CollectedPayloads,
} from "@/lib/documents/bundle-conditions";

interface BundleItem {
  id: string;
  templateId: string;
  order: number;
  required: boolean;
  condition: BundleConditionRule[] | null;
  template: {
    id: string;
    toolName: string;
    toolSlug: string;
    toolDescription: string;
    organisme: { shortName: string | null; name: string; color: string } | null;
    requiresSignature: boolean;
  };
}

interface Bundle {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  color: string;
  items: BundleItem[];
}

interface BundleRunnerProps {
  bundle: Bundle;
  runId: string | null;
  completedTemplateIds: string[];
  payloads: CollectedPayloads;
  templateNames: Record<string, string>;
  fieldLabels: Record<string, string>;
}

export function BundleRunner({
  bundle,
  runId: initialRunId,
  completedTemplateIds,
  payloads,
  templateNames,
  fieldLabels,
}: BundleRunnerProps) {
  const router = useRouter();
  const confirm = useConfirm();
  const [runId, setRunId] = useState<string | null>(initialRunId);
  const [starting, setStarting] = useState(false);

  async function ensureRun(): Promise<string | null> {
    if (runId) return runId;
    setStarting(true);
    try {
      const res = await fetch(`/api/documents/bundles/${bundle.id}/run`, { method: "POST" });
      if (!res.ok) throw new Error("Échec démarrage parcours");
      const run = await res.json();
      setRunId(run.id);
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
    const id = await ensureRun();
    if (!id) return;
    const url = `/outils/${item.template.toolSlug}?bundleRun=${encodeURIComponent(id)}&bundleSlug=${encodeURIComponent(bundle.slug)}`;
    router.push(url);
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

  // Calculer le statut de chaque item
  const itemStatuses = bundle.items.map((item) => {
    const completed = completedTemplateIds.includes(item.templateId);
    const eligibility = evaluateCondition(item.condition, payloads);
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
        <Alert className="bg-green-50 border-green-300 dark:bg-green-950 dark:border-green-800">
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
                    ? "bg-green-50/50 border-green-300 dark:bg-green-950/20"
                    : isPending
                      ? "bg-muted/30 border-dashed opacity-70"
                      : "hover:bg-muted/40"
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
                      {idx + 1}. {item.template.toolName}
                    </span>
                    {item.template.organisme && (
                      <Badge
                        variant="outline"
                        className="text-xs"
                        style={{
                          borderColor: item.template.organisme.color,
                          color: item.template.organisme.color,
                        }}
                      >
                        {item.template.organisme.shortName}
                      </Badge>
                    )}
                    {!item.required && (
                      <Badge variant="secondary" className="text-xs">
                        Optionnel
                      </Badge>
                    )}
                    {item.template.requiresSignature && (
                      <Badge variant="outline" className="text-xs gap-1">
                        <PenTool className="w-3 h-3" />
                        Signature
                      </Badge>
                    )}
                  </div>
                  {item.template.toolDescription && (
                    <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                      {item.template.toolDescription}
                    </p>
                  )}
                  {item.condition && item.condition.length > 0 && (
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
        <Card className="border-dashed bg-muted/20">
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
                <span>{item.template.toolName}</span>
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
    </div>
  );
}
