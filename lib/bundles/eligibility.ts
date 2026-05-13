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
}

export interface EligibilityQuestionBase {
  id: string;
  /// Question affichée au citoyen, en langage simple.
  label: string;
  /// Aide complémentaire (info-bulle).
  helpText?: string;
  /// Référence officielle / lien vers la source.
  helpUrl?: string;
}

export interface EligibilityBooleanQuestion extends EligibilityQuestionBase {
  type: "boolean";
  /// Verdict si réponse = oui.
  verdictTrue: EligibilityVerdict;
  /// Verdict si réponse = non.
  verdictFalse: EligibilityVerdict;
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
  let hasIneligible = false;
  let hasEligible = false;

  for (const q of questions) {
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

  return { verdict: global, answered, total: questions.length, perQuestion };
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

export function parseEligibilityQuestions(input: unknown): EligibilityQuestion[] {
  if (!Array.isArray(input)) return [];
  const out: EligibilityQuestion[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    if (typeof r.id !== "string" || typeof r.label !== "string") continue;
    if (r.type === "boolean") {
      out.push({
        id: r.id,
        label: r.label,
        helpText: typeof r.helpText === "string" ? r.helpText : undefined,
        helpUrl: typeof r.helpUrl === "string" ? r.helpUrl : undefined,
        type: "boolean",
        verdictTrue: parseVerdict(r.verdictTrue) ?? "neutral",
        verdictFalse: parseVerdict(r.verdictFalse) ?? "neutral",
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
        });
      }
      if (opts.length > 0) {
        out.push({
          id: r.id,
          label: r.label,
          helpText: typeof r.helpText === "string" ? r.helpText : undefined,
          helpUrl: typeof r.helpUrl === "string" ? r.helpUrl : undefined,
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
