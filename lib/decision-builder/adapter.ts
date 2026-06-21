/// Adapter : convertit un `DecisionTreeContent` (graphe plat par ID) vers le
/// format `WizardSituation[]` attendu par le composant public `DossierWizard`.
/// Permet de RÉUTILISER le wizard public tel quel (parité visuelle totale) pour
/// la simulation admin (phase 5) et le runtime public (phase 6).
///
/// Le wizard public a une structure FIXE à 3 niveaux :
///   situation → subQuestion → refineQuestion → result
/// Notre arbre est général. Mapping :
///   - racine (question) → ses options deviennent les SITUATIONS
///   - option.nextId question → subQuestion ; option.nextId result → result
///   - idem un cran plus bas pour refineQuestion
/// Au-delà de 3 niveaux, on COLLAPSE la sous-branche vers son premier résultat
/// atteignable (dégradation gracieuse — cohérent avec la capacité du wizard
/// public, qui ne sait afficher que 3 niveaux).
///
/// Pur : zéro dépendance Prisma/Next. Testable.

import type {
  WizardRefineOption,
  WizardResult,
  WizardSituation,
  WizardSubOption,
} from "@/lib/dossier-wizard/config";
import type {
  DecisionTreeContent,
  OptionNode,
  QuestionNode,
  ResultNode,
} from "./types";

const PLACEHOLDER_RESULT: WizardResult = {
  dossierSlug: null,
  dossierTitle: "Bientôt disponible",
  rationale: "Ce dossier sera bientôt accessible.",
};

export function treeContentToWizardSituations(
  content: DecisionTreeContent,
): WizardSituation[] {
  const root = content.rootNodeId ? content.nodes[content.rootNodeId] : null;
  if (!root || root.type !== "question") return [];

  const situations: WizardSituation[] = [];
  for (const optId of root.optionIds) {
    const opt = content.nodes[optId];
    if (!opt || opt.type !== "option") continue;

    const situation: WizardSituation = {
      value: opt.id,
      label: opt.label,
      icon: opt.icon ?? "HelpCircle",
      ...(opt.helpText ? { description: opt.helpText } : {}),
    };

    const target = content.nodes[opt.nextId];
    if (target?.type === "result") {
      situation.result = mapResult(target);
    } else if (target?.type === "question") {
      situation.subQuestion = mapSubQuestion(content, target);
    } else {
      situation.result = firstReachableResult(content, opt.nextId);
    }
    situations.push(situation);
  }
  return situations;
}

function mapSubQuestion(
  content: DecisionTreeContent,
  q: QuestionNode,
): NonNullable<WizardSituation["subQuestion"]> {
  const options: WizardSubOption[] = [];
  for (const oid of q.optionIds) {
    const opt = content.nodes[oid];
    if (!opt || opt.type !== "option") continue;

    const sub: WizardSubOption = {
      value: opt.id,
      label: opt.label,
      ...(opt.helpText ? { helpText: opt.helpText } : {}),
    };
    const target = content.nodes[opt.nextId];
    if (target?.type === "result") {
      sub.result = mapResult(target);
    } else if (target?.type === "question") {
      sub.refineQuestion = mapRefineQuestion(content, target);
    } else {
      sub.result = firstReachableResult(content, opt.nextId);
    }
    options.push(sub);
  }
  return {
    question: q.text,
    ...(q.helpText ? { helpText: q.helpText } : {}),
    options,
  };
}

function mapRefineQuestion(
  content: DecisionTreeContent,
  q: QuestionNode,
): NonNullable<WizardSubOption["refineQuestion"]> {
  const options: WizardRefineOption[] = [];
  for (const oid of q.optionIds) {
    const opt = content.nodes[oid];
    if (!opt || opt.type !== "option") continue;
    const target = content.nodes[opt.nextId];
    // Une refine option résout TOUJOURS vers un résultat (collapse si besoin).
    const result =
      target?.type === "result"
        ? mapResult(target)
        : firstReachableResult(content, opt.nextId);
    options.push({
      value: opt.id,
      label: opt.label,
      ...(opt.helpText ? { helpText: opt.helpText } : {}),
      result,
    });
  }
  return {
    question: q.text,
    ...(q.helpText ? { helpText: q.helpText } : {}),
    options,
  };
}

function mapResult(r: ResultNode): WizardResult {
  return {
    dossierSlug: r.bundleSlug,
    dossierTitle: r.title,
    rationale: r.rationale,
    ...(r.matchLevel ? { matchLevel: r.matchLevel } : {}),
    ...(r.allocationEstimate ? { allocationEstimate: r.allocationEstimate } : {}),
    ...(r.related && r.related.length ? { related: r.related } : {}),
    ...(r.availability ? { availability: r.availability } : {}),
    ...(r.nextStep ? { nextStep: r.nextStep } : {}),
  };
}

/// BFS depuis `fromId` jusqu'au premier nœud résultat atteignable. Sert à
/// collapser une sous-branche trop profonde pour le wizard public 3-niveaux.
function firstReachableResult(
  content: DecisionTreeContent,
  fromId: string,
): WizardResult {
  const seen = new Set<string>();
  const queue = [fromId];
  while (queue.length) {
    const id = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    const node = content.nodes[id];
    if (!node) continue;
    if (node.type === "result") return mapResult(node);
    if (node.type === "question") queue.push(...node.optionIds);
    if (node.type === "option") queue.push(node.nextId);
  }
  return PLACEHOLDER_RESULT;
}
