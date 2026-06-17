/**
 * Abstraction IA d'orientation. Défaut = `local-rules` : explication
 * DÉTERMINISTE sans appel externe (aucune clé requise). openai/anthropic =
 * placeholders (retombent sur local-rules). L'IA ne dit JAMAIS à l'utilisateur
 * quel métier choisir. Voir docs/formations-api-setup.md.
 */
import "server-only";
import { BRANCH_BY_KEY, type BranchKey } from "@/lib/formations/boussole/branches";

export type OrientationAIProviderName = "disabled" | "local-rules" | "mock" | "openai" | "anthropic";

export function getOrientationAIProvider(): OrientationAIProviderName {
  const v = (process.env.TRAINING_AI_PROVIDER || process.env.ORIENTATION_AI_PROVIDER || "local-rules").toLowerCase();
  return (["disabled", "local-rules", "mock", "openai", "anthropic"] as const).includes(
    v as OrientationAIProviderName,
  )
    ? (v as OrientationAIProviderName)
    : "local-rules";
}

const DISCLAIMER =
  "Ces pistes peuvent correspondre à ton profil, mais elles ne remplacent pas un accompagnement professionnel.";

export interface OrientationExplainInput {
  primaryKey: string | null;
  secondaryKeys: string[];
  confidence: number;
}

/**
 * Explication du résultat Boussole. Provider local-rules (déterministe) par
 * défaut ; les providers externes ne sont pas câblés → fallback local.
 */
export async function explainOrientationResult(input: OrientationExplainInput): Promise<{ provider: OrientationAIProviderName; text: string }> {
  const provider = getOrientationAIProvider();
  // openai/anthropic non câblés en V2 → on génère localement.
  const text = localExplanation(input);
  return { provider: provider === "openai" || provider === "anthropic" ? "local-rules" : provider, text };
}

function branchName(key: string | null): string | null {
  if (!key) return null;
  return BRANCH_BY_KEY[key as BranchKey]?.name ?? null;
}

function localExplanation(input: OrientationExplainInput): string {
  const primary = branchName(input.primaryKey);
  if (!primary) {
    return `Réponds à quelques questions de plus pour obtenir des pistes plus précises. ${DISCLAIMER}`;
  }
  const secondaries = input.secondaryKeys.map(branchName).filter(Boolean) as string[];
  const branch = BRANCH_BY_KEY[input.primaryKey as BranchKey];
  const jobs = branch?.possibleJobs.slice(0, 3).join(", ");
  let text = `Sur base de tes réponses, le domaine « ${primary} » semble le mieux correspondre à ton profil`;
  if (secondaries.length) text += `, avec aussi « ${secondaries.join(" » et « ")} » à explorer`;
  text += ".";
  if (jobs) text += ` Des pistes de métiers : ${jobs}.`;
  text += ` ${DISCLAIMER}`;
  return text;
}
