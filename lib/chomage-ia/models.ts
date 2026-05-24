/**
 * Constantes de modèles Claude utilisés par le module IA Chômage.
 *
 * Centralisé ici pour pouvoir bumper la version en un seul endroit quand
 * Anthropic sort un nouveau modèle.
 *
 * Choix :
 *   - Haiku 4.5  : opérations rapides (summarize, extraction simple)
 *   - Sonnet 4.5 : raisonnement sourcé (chat, prompt builder)
 *
 * Le timeout par défaut est de 90s pour le chat (longues réponses sourcées)
 * et 30s pour les opérations courtes (summarize).
 */

export const CLAUDE_MODELS = {
  /** Modèle pour synthèses, extractions courtes, classifications. */
  haiku: "claude-haiku-4-5-20251001",
  /** Modèle pour raisonnement long, citations multi-sources, génération de prompts. */
  sonnet: "claude-sonnet-4-5-20250929",
} as const;

export type ClaudeModel = (typeof CLAUDE_MODELS)[keyof typeof CLAUDE_MODELS];

/** Endpoint Anthropic Messages v1. */
export const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

/** Version d'API Anthropic à passer dans `anthropic-version`. */
export const ANTHROPIC_API_VERSION = "2023-06-01";

/**
 * Budget tokens max pour la totalité du contexte sources injecté.
 * Si on dépasse, on tronque côté serveur (cf. lib/chomage-ia/context.ts).
 * Réf : Sonnet 4.5 supporte 200K context, mais on garde de la marge pour
 * le system prompt + l'historique de messages + la réponse.
 */
export const KB_CONTEXT_BUDGET_TOKENS = 50_000;

/**
 * Approximation simple : 1 token ~= 4 caractères en français.
 * Suffisant pour le ranking budgétaire, pas pour de la facturation précise.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
