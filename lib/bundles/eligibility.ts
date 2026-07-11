/// Pré-qualification informative d'un bundle.
///
/// **Principe fondateur (à respecter à tous les niveaux) :**
/// L'évaluation est **purement informative** — elle ne bloque jamais le
/// citoyen. Même en cas de verdict "non éligible", l'utilisateur peut
/// continuer le parcours s'il le souhaite. Beldoc n'est pas compétent pour
/// décider à la place des administrations.
///
/// Le verdict est calculé localement (côté client ou serveur) à partir des
/// réponses au questionnaire et de la table de mapping de chaque question.

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type EligibilityVerdict = "eligible" | "ineligible" | "neutral";

/// Une option de réponse pour une question de type "select".
export interface EligibilityOption {
  value: string;
  label: string;
  /// Verdict que cette option fait remonter au calcul global.
  verdict: EligibilityVerdict;
  /// Valeur canonique que cette option affirme (cf. lib/parcours/canonical-keys).
  canonicalValue?: string;
}

/// Condition de visibilité d'une question — sérialisable (pour pouvoir
/// transiter via JSON DB). Compare la réponse d'une autre question selon
/// l'opérateur indiqué.
export interface EligibilityVisibleIf {
  fieldId: string;
  op: "equals" | "notEquals" | "in" | "notIn";
  value: string | number | boolean | Array<string | number>;
}

/// Évalue une condition visibleIf contre des réponses d'eligibilité (string
/// uniquement — les réponses booléennes sont stockées comme "true"/"false").
/// Compare aussi loose : tolère "true" === true et casse différente.
export function evaluateVisibleIf(
  cond: EligibilityVisibleIf | undefined,
  answers: EligibilityAnswers
): boolean {
  if (!cond) return true;
  const ref = answers[cond.fieldId];
  const match = (v: string | number | boolean): boolean => {
    if (ref === undefined || ref === "") return false;
    if (typeof v === "string") return ref === v;
    if (typeof v === "boolean") return ref === String(v);
    if (typeof v === "number") return ref === String(v);
    return false;
  };
  switch (cond.op) {
    case "equals":
      return match(cond.value as string | number | boolean);
    case "notEquals":
      return !match(cond.value as string | number | boolean);
    case "in":
      return Array.isArray(cond.value) && cond.value.some((v) => match(v));
    case "notIn":
      return Array.isArray(cond.value) && !cond.value.some((v) => match(v));
  }
}

export interface EligibilityQuestionBase {
  id: string;
  /// Question affichée au citoyen, en langage simple.
  label: string;
  /// Aide complémentaire (info-bulle). Doit rester en langage simple,
  /// accessible aux personnes avec difficultés de compréhension ou
  /// alphabétisation faible.
  helpText?: string;
  /// Référence officielle / lien vers la source.
  helpUrl?: string;
  /// Visibilité conditionnelle — la question n'est affichée que si la
  /// condition est vraie. Si absent, toujours visible.
  visibleIf?: EligibilityVisibleIf;
  /// Clé canonique à laquelle cette question répond (pré-remplissage depuis
  /// l'orientation). Cf. lib/parcours/canonical-keys.
  canonicalKey?: string;
}

export interface EligibilityBooleanQuestion extends EligibilityQuestionBase {
  type: "boolean";
  /// Verdict si réponse = oui.
  verdictTrue: EligibilityVerdict;
  /// Verdict si réponse = non.
  verdictFalse: EligibilityVerdict;
  /// Valeur canonique correspondant à « oui » / « non ».
  canonicalTrue?: string;
  canonicalFalse?: string;
}

export interface EligibilitySelectQuestion extends EligibilityQuestionBase {
  type: "select";
  options: EligibilityOption[];
}

export type EligibilityQuestion =
  | EligibilityBooleanQuestion
  | EligibilitySelectQuestion;

/// Réponses du citoyen : map questionId → valeur saisie.
/// - boolean → "true" | "false"
/// - select → option.value
export type EligibilityAnswers = Record<string, string>;

/// Résultat consolidé d'évaluation.
export interface EligibilityResult {
  verdict: EligibilityVerdict | "unanswered";
  /// Nombre de questions répondues / total
  answered: number;
  total: number;
  /// Détail par question pour expliquer le verdict.
  perQuestion: Array<{
    questionId: string;
    label: string;
    answer: string | null;
    verdict: EligibilityVerdict | null;
  }>;
}

// ---------------------------------------------------------------------------
// Évaluation
// ---------------------------------------------------------------------------

/// Calcule le verdict global :
/// - `unanswered` : aucune question répondue
/// - `ineligible` : au moins une réponse mappée à `ineligible`
/// - `eligible` : toutes les réponses sont `eligible` ou `neutral` (au moins une `eligible`)
/// - `neutral` : toutes les réponses sont `neutral` ou pas de signal fort
export function evaluateEligibility(
  questions: EligibilityQuestion[],
  answers: EligibilityAnswers
): EligibilityResult {
  if (!Array.isArray(questions) || questions.length === 0) {
    return { verdict: "neutral", answered: 0, total: 0, perQuestion: [] };
  }

  const perQuestion: EligibilityResult["perQuestion"] = [];
  let answered = 0;
  let total = 0;
  let hasIneligible = false;
  let hasEligible = false;

  for (const q of questions) {
    // Les questions invisibles (visibleIf non satisfait) ne comptent ni dans
    // le total ni dans le verdict — sinon une question cachée non répondue
    // empêcherait l'utilisateur de continuer / fausserait le verdict.
    if (!evaluateVisibleIf(q.visibleIf, answers)) continue;
    total += 1;

    const answer = answers[q.id] ?? null;
    let verdict: EligibilityVerdict | null = null;

    if (answer !== null && answer !== "") {
      answered += 1;
      verdict = verdictForAnswer(q, answer);
      if (verdict === "ineligible") hasIneligible = true;
      if (verdict === "eligible") hasEligible = true;
    }

    perQuestion.push({
      questionId: q.id,
      label: q.label,
      answer,
      verdict,
    });
  }

  let global: EligibilityVerdict | "unanswered";
  if (answered === 0) global = "unanswered";
  else if (hasIneligible) global = "ineligible";
  else if (hasEligible) global = "eligible";
  else global = "neutral";

  return { verdict: global, answered, total, perQuestion };
}

function verdictForAnswer(
  q: EligibilityQuestion,
  answer: string
): EligibilityVerdict | null {
  if (q.type === "boolean") {
    if (answer === "true") return q.verdictTrue;
    if (answer === "false") return q.verdictFalse;
    return null;
  }
  if (q.type === "select") {
    const opt = q.options.find((o) => o.value === answer);
    return opt?.verdict ?? null;
  }
  return null;
}

/// Helper : message lisible associé à un verdict global, pour l'affichage citoyen.
export function verdictMessageFr(verdict: EligibilityResult["verdict"]): {
  emoji: string;
  title: string;
  tone: "success" | "warning" | "danger" | "neutral";
} {
  switch (verdict) {
    case "eligible":
      return {
        emoji: "🟢",
        title: "Selon les critères officiels, vous semblez éligible.",
        tone: "success",
      };
    case "ineligible":
      return {
        emoji: "🔴",
        title:
          "Selon les critères officiels, vous semblez ne pas répondre à toutes les conditions.",
        tone: "danger",
      };
    case "neutral":
      return {
        emoji: "🟠",
        title: "Cas limite ou information insuffisante.",
        tone: "warning",
      };
    case "unanswered":
    default:
      return {
        emoji: "⚪",
        title: "Aucune question répondue.",
        tone: "neutral",
      };
  }
}

// ---------------------------------------------------------------------------
// Validation type-safe à l'entrée (sécurise les données JSON venant de la base)
// ---------------------------------------------------------------------------

function parseVisibleIf(raw: unknown): EligibilityVisibleIf | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Record<string, unknown>;
  if (typeof r.fieldId !== "string") return undefined;
  if (r.op !== "equals" && r.op !== "notEquals" && r.op !== "in" && r.op !== "notIn") return undefined;
  const v = r.value;
  if (
    typeof v === "string" ||
    typeof v === "number" ||
    typeof v === "boolean" ||
    (Array.isArray(v) && v.every((x) => typeof x === "string" || typeof x === "number"))
  ) {
    return { fieldId: r.fieldId, op: r.op, value: v as EligibilityVisibleIf["value"] };
  }
  return undefined;
}

export function parseEligibilityQuestions(input: unknown): EligibilityQuestion[] {
  if (!Array.isArray(input)) return [];
  const out: EligibilityQuestion[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    if (typeof r.id !== "string" || typeof r.label !== "string") continue;
    const visibleIf = parseVisibleIf(r.visibleIf);
    if (r.type === "boolean") {
      out.push({
        id: r.id,
        label: r.label,
        helpText: typeof r.helpText === "string" ? r.helpText : undefined,
        helpUrl: typeof r.helpUrl === "string" ? r.helpUrl : undefined,
        visibleIf,
        canonicalKey: typeof r.canonicalKey === "string" ? r.canonicalKey : undefined,
        type: "boolean",
        verdictTrue: parseVerdict(r.verdictTrue) ?? "neutral",
        verdictFalse: parseVerdict(r.verdictFalse) ?? "neutral",
        canonicalTrue: typeof r.canonicalTrue === "string" ? r.canonicalTrue : undefined,
        canonicalFalse: typeof r.canonicalFalse === "string" ? r.canonicalFalse : undefined,
      });
    } else if (r.type === "select" && Array.isArray(r.options)) {
      const opts: EligibilityOption[] = [];
      for (const o of r.options) {
        if (!o || typeof o !== "object") continue;
        const oo = o as Record<string, unknown>;
        if (typeof oo.value !== "string" || typeof oo.label !== "string") continue;
        opts.push({
          value: oo.value,
          label: oo.label,
          verdict: parseVerdict(oo.verdict) ?? "neutral",
          canonicalValue: typeof oo.canonicalValue === "string" ? oo.canonicalValue : undefined,
        });
      }
      if (opts.length > 0) {
        out.push({
          id: r.id,
          label: r.label,
          helpText: typeof r.helpText === "string" ? r.helpText : undefined,
          helpUrl: typeof r.helpUrl === "string" ? r.helpUrl : undefined,
          visibleIf,
          canonicalKey: typeof r.canonicalKey === "string" ? r.canonicalKey : undefined,
          type: "select",
          options: opts,
        });
      }
    }
  }
  return out;
}

function parseVerdict(v: unknown): EligibilityVerdict | null {
  if (v === "eligible" || v === "ineligible" || v === "neutral") return v;
  return null;
}

export function parseEligibilityAnswers(input: unknown): EligibilityAnswers {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const out: EligibilityAnswers = {};
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (typeof v === "string") out[k] = v;
    else if (typeof v === "boolean") out[k] = v ? "true" : "false";
    else if (typeof v === "number") out[k] = String(v);
  }
  return out;
}
