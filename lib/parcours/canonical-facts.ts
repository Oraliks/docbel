import { isValidCanonicalPair } from "./canonical-keys";
import type {
  EligibilityQuestion,
  EligibilityAnswers,
} from "@/lib/bundles/eligibility";

/** Faits canoniques dérivés de l'orientation : clé canonique → valeur. */
export type CanonicalFacts = Record<string, string>;

/**
 * Rassemble les faits depuis les options choisies (tags validés contre le
 * registre). Dernier gagnant en cas de conflit sur une même clé.
 */
export function collectCanonicalFacts(
  taggedOptions: (
    | { canonical?: { key: string; value: string } }
    | null
    | undefined
  )[],
): CanonicalFacts {
  const facts: CanonicalFacts = {};
  for (const opt of taggedOptions) {
    const c = opt?.canonical;
    if (!c) continue;
    if (!isValidCanonicalPair(c.key, c.value)) continue;
    facts[c.key] = c.value;
  }
  return facts;
}

/**
 * Réponses de pré-qualification pré-remplies depuis les faits. Ne renvoie QUE
 * les questions mappées dont la clé est présente dans `facts` ET dont une
 * option/valeur correspond. N'écrase RIEN : le caller fusionne (prefill en
 * base, saisie manuelle par-dessus).
 */
export function prefillEligibilityAnswers(
  questions: EligibilityQuestion[],
  facts: CanonicalFacts,
): EligibilityAnswers {
  const out: EligibilityAnswers = {};
  for (const q of questions) {
    const key = q.canonicalKey;
    if (!key) continue;
    const fact = facts[key];
    if (fact === undefined) continue;
    if (q.type === "boolean") {
      if (q.canonicalTrue === fact) out[q.id] = "true";
      else if (q.canonicalFalse === fact) out[q.id] = "false";
    } else {
      const opt = q.options.find((o) => o.canonicalValue === fact);
      if (opt) out[q.id] = opt.value;
    }
  }
  return out;
}
