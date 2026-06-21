"use client";

/// Simulateur de parcours (onglet « Tester ») — V1 : parcours client simple à
/// partir du contenu de l'arbre (aucune API, aucun BundleRun touché). La phase 5
/// remplacera/enrichira ce panneau par un aperçu fidèle du wizard public + un
/// panneau de debug (chemin, conditions évaluées).

import { useMemo, useState } from "react";
import { ArrowRight, RotateCcw, Sparkles, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { runDecisionTree } from "@/lib/decision-builder/engine";
import type {
  DecisionTreeContent,
  OrientationAnswers,
  QuestionNode,
} from "@/lib/decision-builder/types";

export function SimulationPanel({ content }: { content: DecisionTreeContent }) {
  const [answers, setAnswers] = useState<OrientationAnswers>({});

  // Re-exécute l'engine à chaque réponse pour connaître le nœud courant.
  const run = useMemo(() => runDecisionTree(content, answers), [content, answers]);

  // Dernier nœud du chemin = nœud courant (question à répondre, ou résultat).
  const currentId = run.path[run.path.length - 1];
  const currentNode = currentId ? content.nodes[currentId] : null;

  function answer(questionId: string, optionId: string) {
    setAnswers((prev) => ({ ...prev, [questionId]: { value: optionId } }));
  }

  function reset() {
    setAnswers({});
  }

  if (!content.rootNodeId) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground">
        Ajoutez d'abord une question racine pour tester le parcours.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-4 p-6">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-2 text-sm font-medium">
          <Sparkles className="size-4 text-primary" /> Simulation du parcours
        </p>
        <Button variant="outline" size="sm" onClick={reset}>
          <RotateCcw className="size-3.5" /> Recommencer
        </Button>
      </div>

      {/* Fil d'Ariane du chemin parcouru */}
      {run.path.length > 0 && (
        <div className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
          {run.path.map((id, i) => {
            const n = content.nodes[id];
            const label = n
              ? n.type === "question"
                ? (n as QuestionNode).text
                : n.type === "option"
                  ? n.label
                  : n.title
              : id;
            return (
              <span key={`${id}-${i}`} className="inline-flex items-center gap-1">
                {i > 0 && <ArrowRight className="size-3" />}
                <span className="max-w-[140px] truncate rounded bg-muted px-1.5 py-0.5">
                  {label}
                </span>
              </span>
            );
          })}
        </div>
      )}

      {/* Question courante */}
      {currentNode?.type === "question" && (
        <div className="space-y-2 rounded-lg border p-4">
          <p className="font-medium">{currentNode.text}</p>
          {currentNode.helpText && (
            <p className="text-sm text-muted-foreground">{currentNode.helpText}</p>
          )}
          <div className="grid gap-2 pt-1">
            {currentNode.optionIds.map((oid) => {
              const opt = content.nodes[oid];
              if (!opt || opt.type !== "option") return null;
              return (
                <Button
                  key={oid}
                  variant="outline"
                  className="justify-start"
                  onClick={() => answer(currentNode.id, oid)}
                >
                  {opt.label}
                </Button>
              );
            })}
          </div>
        </div>
      )}

      {/* Résultats atteints */}
      {run.results.length > 0 && (
        <div className="space-y-2">
          {run.results.map((r) => (
            <div
              key={r.id}
              className="space-y-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4"
            >
              <div className="flex items-center gap-2">
                <Target className="size-4 text-emerald-600" />
                <span className="font-semibold">{r.title}</span>
                <Badge variant="secondary" className="ml-auto">
                  {r.matchLevel}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{r.rationale}</p>
              <p className="text-xs">
                Dossier :{" "}
                {r.bundleSlug ? (
                  <code className="rounded bg-muted px-1">{r.bundleSlug}</code>
                ) : (
                  <span className="text-amber-600">bientôt disponible</span>
                )}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Warnings de parcours (utile pour debug admin) */}
      {run.warnings.length > 0 && run.results.length === 0 && !currentNode && (
        <p className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-muted-foreground">
          Le parcours s'arrête ici (
          {run.warnings.map((w) => w.code).join(", ")}). Vérifiez le câblage dans
          l'onglet Arbre.
        </p>
      )}
    </div>
  );
}
