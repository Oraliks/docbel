/// Validateur statique d'un arbre d'orientation, calqué sur le pattern de
/// `lib/pdf-forms/publish-checks.ts` : retourne une liste typée de violations
/// classées en `error` (bloquant la publication) ou `warning` (informatif).
///
/// Conçu pour deux usages :
/// - **Avant publication** : `errors.length === 0` requis pour publier.
/// - **Édition admin live** : la canvas surligne les nœuds fautifs en cliquant
///   sur une violation (chaque violation porte un `nodeId` optionnel).

import { isConditionGroup, isConditionLeaf } from "@/lib/bundles/conditions";
import type {
  BundleCondition,
  ConditionGroup,
  ConditionLeaf,
  ConditionNode,
} from "@/lib/bundles/conditions";
import type { DecisionTreeContent } from "./types";

export type ValidationSeverity = "error" | "warning";

export type ValidationCode =
  // Erreurs bloquantes
  | "no_root"                   // pas de rootNodeId défini
  | "missing_root"              // rootNodeId pointe sur un nœud inexistant
  | "wrong_root_type"           // rootNodeId ne pointe pas sur une question
  | "question_no_options"       // une question n'a pas d'option
  | "missing_option"            // une question référence une option inexistante
  | "option_wrong_type"         // une référence "option" pointe sur un autre type
  | "missing_next"              // option.nextId pointe sur un nœud inexistant
  | "next_must_be_question_or_result" // option.nextId pointe sur autre que question/result
  | "unknown_bundle"            // result.bundleSlug n'existe pas dans la liste fournie
  | "condition_unknown_ref"     // condition réfère à un nodeId inexistant
  | "cycle"                     // cycle détecté dans le graphe
  // Avertissements
  | "result_no_bundle"          // result.bundleSlug === null (bientôt disponible)
  | "missing_form"              // bundle ciblé n'a aucun PdfForm rattaché (cul-de-sac)
  | "deep_branch"               // question au-delà du 3e niveau (non rendue en public)
  | "unreachable";              // nœud non atteignable depuis root

export interface Violation {
  severity: ValidationSeverity;
  code: ValidationCode;
  /// Nœud principalement concerné par la violation (pour highlight sur canvas).
  nodeId?: string;
  /// Message humain affichable dans l'UI (FR).
  message: string;
  /// Données contextuelles libres (ex. cycle.path, missing.targetId).
  meta?: Record<string, unknown>;
}

export interface ValidationReport {
  violations: Violation[];
  errors: Violation[];
  warnings: Violation[];
  /// `true` si aucune violation bloquante (= publiable).
  publishable: boolean;
}

/// Options de validation (toutes facultatives → signature rétro-compatible).
export interface ValidateOptions {
  /// Slugs de bundles actifs MAIS sans aucun PdfForm rattaché (cul-de-sac
  /// fonctionnel). Émet un warning `missing_form` pour chaque résultat qui
  /// les cible. Fourni par l'appelant côté serveur (la fonction reste pure).
  bundlesWithoutForm?: Set<string>;
}

/// Valide un arbre. `knownBundleSlugs` = ensemble des slugs `DocumentBundle`
/// actifs en DB ; à fournir par l'appelant (la fonction reste pure, pas de
/// dépendance Prisma).
export function validateDecisionTree(
  content: DecisionTreeContent,
  knownBundleSlugs: Set<string>,
  opts: ValidateOptions = {},
): ValidationReport {
  const v: Violation[] = [];
  const nodes = content.nodes;

  // ── 1. Racine ────────────────────────────────────────────────────────────
  if (!content.rootNodeId) {
    v.push({
      severity: "error",
      code: "no_root",
      message: "L'arbre n'a pas de nœud racine défini.",
    });
    // Sans racine, on continue quand même : on peut détecter les nœuds orphelins.
  } else if (!nodes[content.rootNodeId]) {
    v.push({
      severity: "error",
      code: "missing_root",
      nodeId: content.rootNodeId,
      message: `Le nœud racine "${content.rootNodeId}" est introuvable.`,
    });
  } else if (nodes[content.rootNodeId].type !== "question") {
    v.push({
      severity: "error",
      code: "wrong_root_type",
      nodeId: content.rootNodeId,
      message: "Le nœud racine doit être une question.",
    });
  }

  // ── 2. Vérification de chaque nœud ──────────────────────────────────────
  for (const [nodeId, node] of Object.entries(nodes)) {
    if (node.type === "question") {
      if (node.optionIds.length === 0) {
        v.push({
          severity: "error",
          code: "question_no_options",
          nodeId,
          message: `La question "${nodeId}" n'a aucune option.`,
        });
      }
      for (const optId of node.optionIds) {
        const opt = nodes[optId];
        if (!opt) {
          v.push({
            severity: "error",
            code: "missing_option",
            nodeId,
            message: `L'option "${optId}" est introuvable.`,
            meta: { optionId: optId },
          });
        } else if (opt.type !== "option") {
          v.push({
            severity: "error",
            code: "option_wrong_type",
            nodeId,
            message: `Le nœud "${optId}" devrait être de type "option" (trouvé : "${opt.type}").`,
            meta: { optionId: optId, foundType: opt.type },
          });
        }
      }
    }

    if (node.type === "option") {
      const next = nodes[node.nextId];
      if (!next) {
        v.push({
          severity: "error",
          code: "missing_next",
          nodeId,
          message: `La cible "${node.nextId}" de l'option est introuvable.`,
          meta: { nextId: node.nextId },
        });
      } else if (next.type !== "question" && next.type !== "result") {
        v.push({
          severity: "error",
          code: "next_must_be_question_or_result",
          nodeId,
          message: `Une option doit pointer vers une question ou un résultat (trouvé : "${next.type}").`,
          meta: { nextId: node.nextId, foundType: next.type },
        });
      }
      if (node.conditions) {
        checkConditionRefs(node.conditions, nodeId, nodes, v);
      }
    }

    if (node.type === "result") {
      // `availability` pilote la sévérité : seul un résultat "disponible"
      // (ou sans availability = rétro-compat) exige un bundle actif réel.
      // "a_creer"/"orientation_externe" ne bloquent jamais la publication.
      const availability = node.availability ?? "disponible";

      if (availability === "orientation_externe") {
        // Orientation externe : pas un dossier Docbel → aucune exigence.
      } else if (node.bundleSlug === null) {
        v.push({
          severity: "warning",
          code: "result_no_bundle",
          nodeId,
          message: "Résultat sans dossier (« bientôt disponible »).",
        });
      } else if (!knownBundleSlugs.has(node.bundleSlug)) {
        if (availability === "a_creer") {
          // Dossier prévu mais pas encore actif → simple avertissement.
          v.push({
            severity: "warning",
            code: "result_no_bundle",
            nodeId,
            message: `Le dossier "${node.bundleSlug}" est prévu mais pas encore disponible.`,
            meta: { bundleSlug: node.bundleSlug },
          });
        } else {
          v.push({
            severity: "error",
            code: "unknown_bundle",
            nodeId,
            message: `Le dossier "${node.bundleSlug}" n'existe pas ou n'est pas actif.`,
            meta: { bundleSlug: node.bundleSlug },
          });
        }
      } else if (opts.bundlesWithoutForm?.has(node.bundleSlug)) {
        v.push({
          severity: "warning",
          code: "missing_form",
          nodeId,
          message: `Le dossier "${node.bundleSlug}" n'a aucun formulaire rattaché.`,
          meta: { bundleSlug: node.bundleSlug },
        });
      }
      if (node.conditions) {
        checkConditionRefs(node.conditions, nodeId, nodes, v);
      }
    }
  }

  // ── 3. Détection de cycles (DFS coloration) ─────────────────────────────
  if (content.rootNodeId && nodes[content.rootNodeId]) {
    const cyclePath = findCycle(content);
    if (cyclePath) {
      v.push({
        severity: "error",
        code: "cycle",
        nodeId: cyclePath[0],
        message: `Cycle détecté : ${cyclePath.join(" → ")}.`,
        meta: { path: cyclePath },
      });
    }
  }

  // ── 4. Nœuds non atteignables (warning) ──────────────────────────────────
  if (content.rootNodeId && nodes[content.rootNodeId]) {
    const reachable = computeReachable(content);
    for (const nodeId of Object.keys(nodes)) {
      if (!reachable.has(nodeId)) {
        v.push({
          severity: "warning",
          code: "unreachable",
          nodeId,
          message: `Nœud non atteignable depuis la racine.`,
        });
      }
    }
  }

  // ── 5. Branches trop profondes (warning) ─────────────────────────────────
  // Le wizard public ne rend que 3 niveaux de questions (situation →
  // sous-question → affinage). Une 4e question est collapsée → on avertit.
  if (content.rootNodeId && nodes[content.rootNodeId]) {
    for (const [nodeId, qDepth] of computeQuestionDepths(content)) {
      if (qDepth > 3) {
        v.push({
          severity: "warning",
          code: "deep_branch",
          nodeId,
          message: `Question au-delà du 3e niveau : elle ne sera pas affichée telle quelle dans le wizard public (le parcours sera raccourci jusqu'au premier résultat).`,
          meta: { questionDepth: qDepth },
        });
      }
    }
  }

  const errors = v.filter((x) => x.severity === "error");
  const warnings = v.filter((x) => x.severity === "warning");
  return {
    violations: v,
    errors,
    warnings,
    publishable: errors.length === 0,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers internes
// ─────────────────────────────────────────────────────────────────────────────

/// Extrait les `sourceTemplateId` (= nodeId dans notre contexte) référencés
/// par une condition. Sert à valider que les conditions ne pointent pas dans
/// le vide.
function extractConditionRefs(condition: BundleCondition): string[] {
  if (!condition) return [];
  if (Array.isArray(condition)) {
    return condition.map((r) => r.sourceTemplateId);
  }
  if (isConditionGroup(condition)) {
    return condition.rules.flatMap((r) => extractFromNode(r));
  }
  return [];
}

function extractFromNode(node: ConditionNode): string[] {
  if (isConditionLeaf(node)) return [(node as ConditionLeaf).sourceTemplateId];
  if (isConditionGroup(node))
    return (node as ConditionGroup).rules.flatMap((r) => extractFromNode(r));
  return [];
}

function checkConditionRefs(
  condition: BundleCondition,
  nodeId: string,
  nodes: DecisionTreeContent["nodes"],
  out: Violation[],
): void {
  const refs = extractConditionRefs(condition);
  for (const refId of refs) {
    if (!nodes[refId]) {
      out.push({
        severity: "error",
        code: "condition_unknown_ref",
        nodeId,
        message: `Condition réfère au nœud "${refId}" qui n'existe pas.`,
        meta: { refId },
      });
    }
  }
}

/// Suit les arêtes (option.nextId, question.optionIds, result rien) depuis chaque
/// nœud pour détecter un cycle. Retourne le chemin du premier cycle trouvé.
function findCycle(content: DecisionTreeContent): string[] | null {
  const nodes = content.nodes;
  const WHITE = 0,
    GRAY = 1,
    BLACK = 2;
  const color = new Map<string, number>();
  for (const id of Object.keys(nodes)) color.set(id, WHITE);

  const stack: string[] = [];

  function dfs(nodeId: string): string[] | null {
    const c = color.get(nodeId);
    if (c === GRAY) {
      // Cycle : retourne le chemin depuis le 1er occurrence dans la pile.
      const start = stack.indexOf(nodeId);
      return stack.slice(start).concat(nodeId);
    }
    if (c === BLACK) return null;
    color.set(nodeId, GRAY);
    stack.push(nodeId);

    const node = nodes[nodeId];
    if (node) {
      const edges = outgoingEdges(node);
      for (const next of edges) {
        if (!nodes[next]) continue;
        const cyc = dfs(next);
        if (cyc) return cyc;
      }
    }

    stack.pop();
    color.set(nodeId, BLACK);
    return null;
  }

  // Lance depuis la racine si possible, sinon depuis tous les nœuds.
  const startIds = content.rootNodeId
    ? [content.rootNodeId]
    : Object.keys(nodes);
  for (const id of startIds) {
    const cyc = dfs(id);
    if (cyc) return cyc;
  }
  return null;
}

function outgoingEdges(node: DecisionTreeContent["nodes"][string]): string[] {
  if (node.type === "question") return node.optionIds;
  if (node.type === "option") return [node.nextId];
  return [];
}

/// Profondeur en QUESTIONS de chaque question (root question = 1, sa
/// sous-question = 2, etc.). Sert à détecter les branches > 3 niveaux que le
/// wizard public ne peut pas rendre.
function computeQuestionDepths(content: DecisionTreeContent): Map<string, number> {
  const nodes = content.nodes;
  const out = new Map<string, number>();
  if (!content.rootNodeId) return out;
  const seen = new Set<string>();
  const queue: { id: string; qd: number }[] = [{ id: content.rootNodeId, qd: 1 }];
  while (queue.length) {
    const { id, qd } = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    const node = nodes[id];
    if (!node) continue;
    if (node.type === "question") {
      out.set(id, qd);
      for (const optId of node.optionIds) {
        if (nodes[optId]) queue.push({ id: optId, qd });
      }
    } else if (node.type === "option") {
      const next = nodes[node.nextId];
      if (next) {
        queue.push({ id: node.nextId, qd: next.type === "question" ? qd + 1 : qd });
      }
    }
  }
  return out;
}

function computeReachable(content: DecisionTreeContent): Set<string> {
  const reachable = new Set<string>();
  if (!content.rootNodeId) return reachable;
  const stack = [content.rootNodeId];
  while (stack.length) {
    const id = stack.pop()!;
    if (reachable.has(id)) continue;
    reachable.add(id);
    const node = content.nodes[id];
    if (!node) continue;
    for (const next of outgoingEdges(node)) {
      if (!reachable.has(next)) stack.push(next);
    }
  }
  return reachable;
}
