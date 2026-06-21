/// Construit un `DecisionTreeContent` à partir de `WizardSituation[]` (la config
/// TS historique). Inverse de `adapter.ts`. Sert :
///   - au seed (importer les 7 situations chômage existantes en DB),
///   - au test de parité (garantir 0 régression : adapter(fromWizard(X)) ≈ X).
///
/// Pur : zéro dépendance Prisma/Next. IDs déterministes basés sur le chemin
/// (situation/sub/refine) → réexécution idempotente, pas de collision.

import type {
  WizardResult,
  WizardSituation,
  WizardSubOption,
} from "@/lib/dossier-wizard/config";
import { CONTENT_VERSION } from "./schema";
import type {
  DecisionNode,
  DecisionTreeContent,
  ResultNode,
} from "./types";

const ROOT_ID = "q_root";
const ROOT_QUESTION = "Quelle est votre situation actuelle ?";

export function wizardSituationsToTreeContent(
  situations: WizardSituation[],
): DecisionTreeContent {
  const nodes: Record<string, DecisionNode> = {};
  const rootOptionIds: string[] = [];

  for (const sit of situations) {
    const optId = `opt_${sit.value}`;
    rootOptionIds.push(optId);

    let nextId: string;
    if (sit.subQuestion) {
      nextId = `q_${sit.value}`;
      buildSubQuestion(nodes, nextId, sit.subQuestion, sit.value);
    } else {
      nextId = `r_${sit.value}`;
      nodes[nextId] = resultNode(nextId, sit.result!);
    }

    nodes[optId] = {
      type: "option",
      id: optId,
      label: sit.label,
      icon: sit.icon,
      ...(sit.description ? { helpText: sit.description } : {}),
      nextId,
    };
  }

  nodes[ROOT_ID] = {
    type: "question",
    id: ROOT_ID,
    text: ROOT_QUESTION,
    optionIds: rootOptionIds,
  };

  return { version: CONTENT_VERSION, rootNodeId: ROOT_ID, nodes };
}

function buildSubQuestion(
  nodes: Record<string, DecisionNode>,
  qId: string,
  subQ: NonNullable<WizardSituation["subQuestion"]>,
  sitValue: string,
): void {
  const optionIds: string[] = [];
  for (const sub of subQ.options) {
    const optId = `opt_${sitValue}_${sub.value}`;
    optionIds.push(optId);

    let nextId: string;
    if (sub.refineQuestion) {
      nextId = `q_${sitValue}_${sub.value}`;
      buildRefineQuestion(nodes, nextId, sub.refineQuestion, sitValue, sub.value);
    } else {
      nextId = `r_${sitValue}_${sub.value}`;
      nodes[nextId] = resultNode(nextId, sub.result!);
    }

    nodes[optId] = {
      type: "option",
      id: optId,
      label: sub.label,
      ...(sub.helpText ? { helpText: sub.helpText } : {}),
      nextId,
    };
  }

  nodes[qId] = {
    type: "question",
    id: qId,
    text: subQ.question,
    ...(subQ.helpText ? { helpText: subQ.helpText } : {}),
    optionIds,
  };
}

function buildRefineQuestion(
  nodes: Record<string, DecisionNode>,
  qId: string,
  refineQ: NonNullable<WizardSubOption["refineQuestion"]>,
  sitValue: string,
  subValue: string,
): void {
  const optionIds: string[] = [];
  for (const ref of refineQ.options) {
    const optId = `opt_${sitValue}_${subValue}_${ref.value}`;
    const rId = `r_${sitValue}_${subValue}_${ref.value}`;
    optionIds.push(optId);
    nodes[rId] = resultNode(rId, ref.result);
    nodes[optId] = {
      type: "option",
      id: optId,
      label: ref.label,
      ...(ref.helpText ? { helpText: ref.helpText } : {}),
      nextId: rId,
    };
  }

  nodes[qId] = {
    type: "question",
    id: qId,
    text: refineQ.question,
    ...(refineQ.helpText ? { helpText: refineQ.helpText } : {}),
    optionIds,
  };
}

function resultNode(id: string, wr: WizardResult): ResultNode {
  return {
    type: "result",
    id,
    bundleSlug: wr.dossierSlug,
    title: wr.dossierTitle,
    rationale: wr.rationale,
    matchLevel: wr.matchLevel ?? "recommande",
    ...(wr.allocationEstimate ? { allocationEstimate: true } : {}),
    ...(wr.related && wr.related.length ? { related: wr.related } : {}),
    ...(wr.availability ? { availability: wr.availability } : {}),
    ...(wr.nextStep ? { nextStep: wr.nextStep } : {}),
  };
}
