/// Évaluateur de conditions sur les items d'un bundle.
///
/// Deux formats supportés (lecture transparente, écriture en format v2) :
///
/// **V1 (legacy, lecture seule)** — tableau de règles implicitement ANDées :
/// `[{ sourceTemplateId, fieldId, op, value }, ...]`
///
/// **V2 (nouveau, lecture + écriture)** — arbre récursif avec groupes AND/OR :
/// ```
/// { type: "and" | "or", rules: ConditionNode[] }
/// ```
/// où chaque `ConditionNode` est soit une feuille `ConditionLeaf`, soit un autre groupe.
///
/// Une feuille :
/// `{ type: "leaf", sourceTemplateId, fieldId, op, value }`
///
/// Opérateurs supportés :
/// - `equals`, `notEquals` : comparaison stricte (string-cast)
/// - `in`, `notIn` : valeur dans / hors d'une liste
/// - `contains` : sous-chaîne (case-insensitive)
/// - `truthy`, `falsy` : présence/absence
/// - `gt`, `lt`, `gte`, `lte` : comparaisons numériques
/// - `isEmpty`, `isNotEmpty` : vide / non-vide (chaînes ou tableaux)

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ConditionOp =
  | "equals"
  | "notEquals"
  | "in"
  | "notIn"
  | "contains"
  | "truthy"
  | "falsy"
  | "gt"
  | "lt"
  | "gte"
  | "lte"
  | "isEmpty"
  | "isNotEmpty";

export type GroupOp = "and" | "or";

/// Règle "feuille" V2 (avec discriminant `type: "leaf"`).
export interface ConditionLeaf {
  type: "leaf";
  sourceTemplateId: string;
  fieldId: string;
  op: ConditionOp;
  value?: string | number | boolean | (string | number | boolean)[];
}

/// Groupe V2 (AND/OR récursif).
export interface ConditionGroup {
  type: GroupOp;
  rules: ConditionNode[];
}

export type ConditionNode = ConditionLeaf | ConditionGroup;

/// Règle "feuille" V1 (legacy, sans discriminant `type`).
/// Conservée pour la rétro-compatibilité avec les bundles déjà en base.
export interface BundleConditionRule {
  sourceTemplateId: string;
  fieldId: string;
  op: ConditionOp;
  value?: string | number | boolean | (string | number | boolean)[];
}

/// Format stocké en base sur `DocumentBundleItem.condition`.
/// - `null` ou tableau vide → toujours requis (aucune condition)
/// - `BundleConditionRule[]` → format legacy V1 (ANDé implicite)
/// - `ConditionGroup` → format V2 (arbre récursif)
export type BundleCondition = ConditionGroup | BundleConditionRule[] | null;

/// Map : `templateId` → payload validé du document complété.
export type CollectedPayloads = Record<string, Record<string, unknown>>;

/// Résultat de l'évaluation : `true` (inclus), `false` (exclu), `"pending"` (données manquantes).
export type EvaluationResult = true | false | "pending";

// ---------------------------------------------------------------------------
// Normalisation V1 → V2
// ---------------------------------------------------------------------------

export function isConditionGroup(value: unknown): value is ConditionGroup {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const v = value as { type?: unknown; rules?: unknown };
  return (v.type === "and" || v.type === "or") && Array.isArray(v.rules);
}

export function isConditionLeaf(value: unknown): value is ConditionLeaf {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const v = value as { type?: unknown };
  return v.type === "leaf";
}

/// Convertit le format legacy V1 (tableau ANDé) en groupe V2.
/// Si l'entrée est déjà un groupe V2, retourne tel quel.
/// Si l'entrée est null/vide, retourne null.
export function normalizeCondition(condition: BundleCondition): ConditionGroup | null {
  if (!condition) return null;
  if (Array.isArray(condition)) {
    if (condition.length === 0) return null;
    return {
      type: "and",
      rules: condition.map(legacyRuleToLeaf),
    };
  }
  if (isConditionGroup(condition)) return condition;
  return null;
}

function legacyRuleToLeaf(rule: BundleConditionRule): ConditionLeaf {
  return {
    type: "leaf",
    sourceTemplateId: rule.sourceTemplateId,
    fieldId: rule.fieldId,
    op: rule.op,
    value: rule.value,
  };
}

// ---------------------------------------------------------------------------
// Évaluation
// ---------------------------------------------------------------------------

/// Évalue une condition contre les payloads collectés.
/// Retourne :
/// - `true` : condition vérifiée ou aucune condition
/// - `false` : condition non vérifiée
/// - `"pending"` : au moins une feuille référence un payload non encore disponible,
///                 et le résultat reste indéterminé (l'évaluation partielle ne tranche pas)
export function evaluateCondition(
  condition: BundleCondition,
  payloads: CollectedPayloads
): EvaluationResult {
  const group = normalizeCondition(condition);
  if (!group) return true;
  return evaluateNode(group, payloads);
}

function evaluateNode(node: ConditionNode, payloads: CollectedPayloads): EvaluationResult {
  if (node.type === "leaf") {
    return evaluateLeaf(node, payloads);
  }
  return evaluateGroup(node, payloads);
}

function evaluateGroup(group: ConditionGroup, payloads: CollectedPayloads): EvaluationResult {
  if (group.rules.length === 0) return true;

  const results = group.rules.map((r) => evaluateNode(r, payloads));

  if (group.type === "and") {
    // AND : false si une règle est false ; pending si une règle est pending ; sinon true
    if (results.some((r) => r === false)) return false;
    if (results.some((r) => r === "pending")) return "pending";
    return true;
  }
  // OR : true si une règle est true ; pending s'il reste des règles pending ; sinon false
  if (results.some((r) => r === true)) return true;
  if (results.some((r) => r === "pending")) return "pending";
  return false;
}

function evaluateLeaf(leaf: ConditionLeaf, payloads: CollectedPayloads): EvaluationResult {
  const payload = payloads[leaf.sourceTemplateId];
  if (!payload) return "pending";
  const fieldValue = payload[leaf.fieldId];
  return evaluateOp(leaf.op, fieldValue, leaf.value);
}

function evaluateOp(
  op: ConditionOp,
  value: unknown,
  expected: ConditionLeaf["value"]
): boolean {
  switch (op) {
    case "truthy":
      return !!value && value !== "false" && value !== "0";
    case "falsy":
      return !value || value === "false" || value === "0";
    case "equals":
      return String(value) === String(expected);
    case "notEquals":
      return String(value) !== String(expected);
    case "in":
      if (!Array.isArray(expected)) return false;
      return expected.map(String).includes(String(value));
    case "notIn":
      if (!Array.isArray(expected)) return false;
      return !expected.map(String).includes(String(value));
    case "contains":
      return String(value).toLowerCase().includes(String(expected ?? "").toLowerCase());
    case "gt":
    case "lt":
    case "gte":
    case "lte": {
      const a = toNumber(value);
      const b = toNumber(expected);
      if (a === null || b === null) return false;
      if (op === "gt") return a > b;
      if (op === "lt") return a < b;
      if (op === "gte") return a >= b;
      return a <= b;
    }
    case "isEmpty":
      if (value == null) return true;
      if (Array.isArray(value)) return value.length === 0;
      return String(value).trim().length === 0;
    case "isNotEmpty":
      if (value == null) return false;
      if (Array.isArray(value)) return value.length > 0;
      return String(value).trim().length > 0;
    default:
      return false;
  }
}

function toNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Description en langage naturel (pour l'admin et l'affichage citoyen)
// ---------------------------------------------------------------------------

/// `templateNames` : mapping templateId → nom lisible
/// `fieldLabels` : mapping `${templateId}::${fieldId}` → label lisible
export function describeCondition(
  condition: BundleCondition,
  templateNames: Record<string, string>,
  fieldLabels: Record<string, string>,
  lang: "fr" | "nl" = "fr"
): string {
  const group = normalizeCondition(condition);
  if (!group) return "";
  return describeNode(group, templateNames, fieldLabels, lang, /*topLevel*/ true);
}

function describeNode(
  node: ConditionNode,
  templateNames: Record<string, string>,
  fieldLabels: Record<string, string>,
  lang: "fr" | "nl",
  topLevel: boolean
): string {
  if (node.type === "leaf") {
    return describeLeaf(node, templateNames, fieldLabels, lang);
  }
  if (node.rules.length === 0) return "";
  if (node.rules.length === 1) {
    return describeNode(node.rules[0], templateNames, fieldLabels, lang, topLevel);
  }
  const sep = node.type === "and" ? (lang === "nl" ? " EN " : " ET ") : (lang === "nl" ? " OF " : " OU ");
  const inner = node.rules
    .map((r) => describeNode(r, templateNames, fieldLabels, lang, /*topLevel*/ false))
    .filter(Boolean)
    .join(sep);
  return topLevel ? inner : `(${inner})`;
}

function describeLeaf(
  leaf: ConditionLeaf,
  templateNames: Record<string, string>,
  fieldLabels: Record<string, string>,
  lang: "fr" | "nl"
): string {
  const tplName = templateNames[leaf.sourceTemplateId] || "(document inconnu)";
  const fieldKey = `${leaf.sourceTemplateId}::${leaf.fieldId}`;
  const fieldLabel = fieldLabels[fieldKey] || leaf.fieldId;
  const valueStr = Array.isArray(leaf.value)
    ? leaf.value.join(", ")
    : String(leaf.value ?? "");
  const inFr = (s: string) => `« ${fieldLabel} » dans ${tplName} ${s}`;
  const inNl = (s: string) => `« ${fieldLabel} » in ${tplName} ${s}`;
  const t = lang === "nl" ? inNl : inFr;
  switch (leaf.op) {
    case "equals":
      return t(`= ${valueStr}`);
    case "notEquals":
      return t(`≠ ${valueStr}`);
    case "in":
      return t(`∈ {${valueStr}}`);
    case "notIn":
      return t(`∉ {${valueStr}}`);
    case "contains":
      return t(lang === "nl" ? `bevat « ${valueStr} »` : `contient « ${valueStr} »`);
    case "truthy":
      return t(lang === "nl" ? `is aangevinkt` : `est cochée`);
    case "falsy":
      return t(lang === "nl" ? `is niet aangevinkt` : `n'est pas cochée`);
    case "gt":
      return t(`> ${valueStr}`);
    case "lt":
      return t(`< ${valueStr}`);
    case "gte":
      return t(`≥ ${valueStr}`);
    case "lte":
      return t(`≤ ${valueStr}`);
    case "isEmpty":
      return t(lang === "nl" ? `is leeg` : `est vide`);
    case "isNotEmpty":
      return t(lang === "nl" ? `is niet leeg` : `est rempli`);
    default:
      return t("?");
  }
}

// ---------------------------------------------------------------------------
// Helpers pour l'admin (manipulation d'arbres)
// ---------------------------------------------------------------------------

/// Crée un groupe vide.
export function emptyGroup(op: GroupOp = "and"): ConditionGroup {
  return { type: op, rules: [] };
}

/// Crée une feuille avec des valeurs par défaut.
export function emptyLeaf(sourceTemplateId = "", fieldId = ""): ConditionLeaf {
  return { type: "leaf", sourceTemplateId, fieldId, op: "equals", value: "" };
}

/// Compte le nombre de feuilles dans une condition.
export function countLeaves(condition: BundleCondition): number {
  const group = normalizeCondition(condition);
  if (!group) return 0;
  return countLeavesInNode(group);
}

function countLeavesInNode(node: ConditionNode): number {
  if (node.type === "leaf") return 1;
  return node.rules.reduce((acc, r) => acc + countLeavesInNode(r), 0);
}

/// Indique si la condition pourrait être représentée en V1 (uniquement des feuilles ANDées).
/// Sert au "mode simple" de l'éditeur : on bascule en mode avancé si OR ou imbrication.
export function isFlatAndCondition(condition: BundleCondition): boolean {
  if (!condition) return true;
  if (Array.isArray(condition)) return true;
  const group = normalizeCondition(condition);
  if (!group) return true;
  if (group.type !== "and") return false;
  return group.rules.every((r) => r.type === "leaf");
}
