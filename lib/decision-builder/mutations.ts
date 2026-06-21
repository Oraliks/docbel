/// Opérations structurelles PURES sur un `DecisionTreeContent`. Toutes immuables
/// (retournent un nouveau contenu, ne mutent jamais l'entrée). Utilisées par
/// l'inspecteur de l'éditeur admin. Zéro React → testables en Vitest.
///
/// Invariant maintenu : l'arbre reste toujours schéma-valide après chaque op
/// (ex. ajouter une option crée aussi un résultat-placeholder pour que
/// `option.nextId` pointe sur quelque chose).

import type {
  BundleCondition,
  DecisionNode,
  DecisionTreeContent,
  MatchLevel,
  OptionNode,
  QuestionNode,
  ResultNode,
} from "./types";

/// Générateur d'ID court. Injectable pour les tests (déterminisme).
export type IdGen = (prefix: string) => string;

const defaultIdGen: IdGen = (prefix) =>
  `${prefix}_${Math.random().toString(36).slice(2, 9)}`;

function cloneNodes(
  nodes: DecisionTreeContent["nodes"],
): DecisionTreeContent["nodes"] {
  return { ...nodes };
}

// ---------------------------------------------------------------------------
// Création de nœuds
// ---------------------------------------------------------------------------

/// Crée la question racine d'un arbre vide. No-op si une racine existe déjà.
export function addRootQuestion(
  content: DecisionTreeContent,
  text = "Nouvelle question",
  gen: IdGen = defaultIdGen,
): { content: DecisionTreeContent; id: string } {
  const id = gen("q");
  const node: QuestionNode = { type: "question", id, text, optionIds: [] };
  return {
    content: {
      ...content,
      rootNodeId: content.rootNodeId ?? id,
      nodes: { ...cloneNodes(content.nodes), [id]: node },
    },
    id,
  };
}

/// Ajoute une option à une question. Crée AUSSI un résultat-placeholder
/// (bundleSlug=null) pour que `option.nextId` soit toujours valide.
export function addOption(
  content: DecisionTreeContent,
  questionId: string,
  label = "Nouvelle réponse",
  gen: IdGen = defaultIdGen,
): { content: DecisionTreeContent; optionId: string; resultId: string } | null {
  const q = content.nodes[questionId];
  if (!q || q.type !== "question") return null;

  const resultId = gen("r");
  const optionId = gen("opt");
  const result: ResultNode = {
    type: "result",
    id: resultId,
    bundleSlug: null,
    title: "Résultat à définir",
    rationale: "À compléter.",
    matchLevel: "recommande",
  };
  const option: OptionNode = {
    type: "option",
    id: optionId,
    label,
    nextId: resultId,
  };
  const nextQuestion: QuestionNode = {
    ...q,
    optionIds: [...q.optionIds, optionId],
  };
  return {
    content: {
      ...content,
      nodes: {
        ...cloneNodes(content.nodes),
        [questionId]: nextQuestion,
        [optionId]: option,
        [resultId]: result,
      },
    },
    optionId,
    resultId,
  };
}

// ---------------------------------------------------------------------------
// Édition d'un nœud
// ---------------------------------------------------------------------------

type QuestionPatch = Partial<Pick<QuestionNode, "text" | "helpText" | "icon" | "description">>;
type OptionPatch = Partial<Pick<OptionNode, "label" | "helpText" | "icon" | "conditions">>;
type ResultPatch = Partial<
  Pick<
    ResultNode,
    "bundleSlug" | "title" | "rationale" | "matchLevel" | "allocationEstimate" | "related" | "conditions"
  >
>;

/// Patch typé selon le type du nœud. Ignore silencieusement les clés non
/// applicables au type (sécurité). Retourne le contenu inchangé si nœud absent.
export function patchNode(
  content: DecisionTreeContent,
  id: string,
  patch: QuestionPatch | OptionPatch | ResultPatch,
): DecisionTreeContent {
  const node = content.nodes[id];
  if (!node) return content;
  const merged = { ...node, ...patch } as DecisionNode;
  return {
    ...content,
    nodes: { ...cloneNodes(content.nodes), [id]: merged },
  };
}

/// Définit les conditions d'une option ou d'un résultat.
export function setNodeConditions(
  content: DecisionTreeContent,
  id: string,
  conditions: BundleCondition,
): DecisionTreeContent {
  const node = content.nodes[id];
  if (!node || (node.type !== "option" && node.type !== "result")) {
    return content;
  }
  return patchNode(content, id, { conditions } as OptionPatch | ResultPatch);
}

// ---------------------------------------------------------------------------
// Câblage des options (où mène une option)
// ---------------------------------------------------------------------------

/// Pointe une option vers un nœud existant (question ou résultat).
export function setOptionNext(
  content: DecisionTreeContent,
  optionId: string,
  nextId: string,
): DecisionTreeContent {
  const opt = content.nodes[optionId];
  if (!opt || opt.type !== "option") return content;
  if (!content.nodes[nextId]) return content;
  return {
    ...content,
    nodes: {
      ...cloneNodes(content.nodes),
      [optionId]: { ...opt, nextId },
    },
  };
}

/// Crée une nouvelle question et y branche l'option (remplace sa cible).
export function branchOptionToNewQuestion(
  content: DecisionTreeContent,
  optionId: string,
  text = "Nouvelle question",
  gen: IdGen = defaultIdGen,
): { content: DecisionTreeContent; questionId: string } | null {
  const opt = content.nodes[optionId];
  if (!opt || opt.type !== "option") return null;
  const questionId = gen("q");
  const question: QuestionNode = {
    type: "question",
    id: questionId,
    text,
    optionIds: [],
  };
  return {
    content: {
      ...content,
      nodes: {
        ...cloneNodes(content.nodes),
        [questionId]: question,
        [optionId]: { ...opt, nextId: questionId },
      },
    },
    questionId,
  };
}

/// Crée un nouveau résultat et y branche l'option (remplace sa cible).
export function branchOptionToNewResult(
  content: DecisionTreeContent,
  optionId: string,
  gen: IdGen = defaultIdGen,
): { content: DecisionTreeContent; resultId: string } | null {
  const opt = content.nodes[optionId];
  if (!opt || opt.type !== "option") return null;
  const resultId = gen("r");
  const result: ResultNode = {
    type: "result",
    id: resultId,
    bundleSlug: null,
    title: "Résultat à définir",
    rationale: "À compléter.",
    matchLevel: "recommande",
  };
  return {
    content: {
      ...content,
      nodes: {
        ...cloneNodes(content.nodes),
        [resultId]: result,
        [optionId]: { ...opt, nextId: resultId },
      },
    },
    resultId,
  };
}

// ---------------------------------------------------------------------------
// Suppression
// ---------------------------------------------------------------------------

/// Supprime un nœud et nettoie les références directes (retrait des optionIds).
/// Les `nextId` devenus pendants sont signalés par le validateur (l'admin
/// re-câble) — on ne cascade pas pour éviter des suppressions surprises.
export function deleteNode(
  content: DecisionTreeContent,
  id: string,
): DecisionTreeContent {
  if (!content.nodes[id]) return content;
  const nodes = cloneNodes(content.nodes);
  delete nodes[id];

  // Retire l'ID des optionIds de toutes les questions.
  for (const [nid, node] of Object.entries(nodes)) {
    if (node.type === "question" && node.optionIds.includes(id)) {
      nodes[nid] = {
        ...node,
        optionIds: node.optionIds.filter((o) => o !== id),
      };
    }
  }

  return {
    ...content,
    nodes,
    rootNodeId: content.rootNodeId === id ? null : content.rootNodeId,
  };
}

// ---------------------------------------------------------------------------
// Helpers de lecture (pour construire les props du condition-editor)
// ---------------------------------------------------------------------------

/// Liste les questions de l'arbre (sources possibles d'une condition).
export function listQuestions(content: DecisionTreeContent): QuestionNode[] {
  return Object.values(content.nodes).filter(
    (n): n is QuestionNode => n.type === "question",
  );
}

/// Construit le `templateSchemas` attendu par `BundleConditionEditor` :
/// chaque question expose un champ `value` dont les options sont ses réponses.
export function buildConditionSchemas(
  content: DecisionTreeContent,
): Record<string, { id: string; label: string; type: string; options?: { value: string; label: string }[] }[]> {
  const out: Record<
    string,
    { id: string; label: string; type: string; options?: { value: string; label: string }[] }[]
  > = {};
  for (const q of listQuestions(content)) {
    const options = q.optionIds
      .map((oid) => content.nodes[oid])
      .filter((n): n is OptionNode => !!n && n.type === "option")
      .map((o) => ({ value: o.id, label: o.label }));
    out[q.id] = [
      { id: "value", label: "Réponse", type: "select", options },
    ];
  }
  return out;
}

export const MATCH_LEVELS: { value: MatchLevel; label: string }[] = [
  { value: "recommande", label: "Recommandé" },
  { value: "pertinent", label: "Pertinent" },
  { value: "a_verifier", label: "À vérifier" },
];
