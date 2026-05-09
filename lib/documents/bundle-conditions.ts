/// Évaluateur de conditions sur les items d'un bundle.
///
/// Une condition est un tableau de règles ANDées :
/// `[{ sourceTemplateId, fieldId, op, value }]`
///
/// - `sourceTemplateId` : ID du template dont on lit le payload (autre item du bundle)
/// - `fieldId` : ID du champ dans le schema de ce template
/// - `op` : "equals" | "notEquals" | "in" | "contains" | "truthy" | "falsy"
/// - `value` : valeur de comparaison (string | number | boolean | array selon op)

export type ConditionOp = "equals" | "notEquals" | "in" | "contains" | "truthy" | "falsy";

export interface BundleConditionRule {
  sourceTemplateId: string;
  fieldId: string;
  op: ConditionOp;
  value?: string | number | boolean | (string | number | boolean)[];
}

export type BundleCondition = BundleConditionRule[] | null;

/// Map: templateId → payload validé du document complété
export type CollectedPayloads = Record<string, Record<string, unknown>>;

/// Évalue une condition contre les payloads collectés.
/// Retourne `true` si :
/// - condition est null/empty (pas de condition → toujours requis)
/// - toutes les règles sont vérifiées
///
/// Si une règle référence un payload non encore collecté, retourne `null` (= "indéterminé").
/// L'appelant peut alors décider d'afficher l'item comme "en attente" plutôt que "requis"/"masqué".
export function evaluateCondition(
  condition: BundleCondition,
  payloads: CollectedPayloads
): true | false | "pending" {
  if (!condition || condition.length === 0) return true;

  let allKnown = true;

  for (const rule of condition) {
    const payload = payloads[rule.sourceTemplateId];
    if (!payload) {
      allKnown = false;
      continue;
    }
    const fieldValue = payload[rule.fieldId];
    if (!evaluateRule(rule, fieldValue)) {
      return false;
    }
  }

  if (!allKnown) return "pending";
  return true;
}

function evaluateRule(rule: BundleConditionRule, value: unknown): boolean {
  switch (rule.op) {
    case "truthy":
      return !!value && value !== "false" && value !== "0";
    case "falsy":
      return !value || value === "false" || value === "0";
    case "equals":
      return String(value) === String(rule.value);
    case "notEquals":
      return String(value) !== String(rule.value);
    case "in":
      if (!Array.isArray(rule.value)) return false;
      return rule.value.map(String).includes(String(value));
    case "contains":
      return String(value).toLowerCase().includes(String(rule.value).toLowerCase());
    default:
      return true;
  }
}

/// Décrit une condition en langage naturel pour l'affichage utilisateur.
/// `templateNames` est un mapping templateId → nom lisible.
/// `fieldLabels` est un mapping `${templateId}::${fieldId}` → label lisible.
export function describeCondition(
  condition: BundleCondition,
  templateNames: Record<string, string>,
  fieldLabels: Record<string, string>,
  lang: "fr" | "nl" = "fr"
): string {
  if (!condition || condition.length === 0) return "";

  const parts = condition.map((rule) => {
    const tplName = templateNames[rule.sourceTemplateId] || "(document inconnu)";
    const fieldKey = `${rule.sourceTemplateId}::${rule.fieldId}`;
    const fieldLabel = fieldLabels[fieldKey] || rule.fieldId;
    const valueStr =
      Array.isArray(rule.value)
        ? rule.value.join(", ")
        : String(rule.value ?? "");

    if (lang === "nl") {
      switch (rule.op) {
        case "equals":
          return `« ${fieldLabel} » in ${tplName} = ${valueStr}`;
        case "notEquals":
          return `« ${fieldLabel} » in ${tplName} ≠ ${valueStr}`;
        case "in":
          return `« ${fieldLabel} » in ${tplName} ∈ {${valueStr}}`;
        case "contains":
          return `« ${fieldLabel} » in ${tplName} bevat « ${valueStr} »`;
        case "truthy":
          return `« ${fieldLabel} » in ${tplName} is aangevinkt`;
        case "falsy":
          return `« ${fieldLabel} » in ${tplName} is niet aangevinkt`;
      }
    }
    switch (rule.op) {
      case "equals":
        return `« ${fieldLabel} » dans ${tplName} = ${valueStr}`;
      case "notEquals":
        return `« ${fieldLabel} » dans ${tplName} ≠ ${valueStr}`;
      case "in":
        return `« ${fieldLabel} » dans ${tplName} ∈ {${valueStr}}`;
      case "contains":
        return `« ${fieldLabel} » dans ${tplName} contient « ${valueStr} »`;
      case "truthy":
        return `« ${fieldLabel} » dans ${tplName} est cochée`;
      case "falsy":
        return `« ${fieldLabel} » dans ${tplName} n'est pas cochée`;
    }
  });

  return parts.join(" ET ");
}
