/**
 * Pricing helpers — module Assistant IA Chômage.
 *
 * Centralise le calcul de coût estimé des appels Claude (Sonnet 4.5 + Haiku 4.5)
 * et la conversion USD → EUR pour l'affichage côté admin.
 *
 * Source des tarifs : https://www.anthropic.com/pricing (au 2026-05).
 * Le taux EUR est figé volontairement (pas d'appel à une API forex) — on
 * affiche un « ≈ » dans l'UI pour rappeler que c'est une estimation indicative.
 *
 * Tous les chiffres sont en USD par MILLION de tokens.
 */
import { CLAUDE_MODELS, type ClaudeModel } from "./models";

/**
 * Grille tarifaire officielle Anthropic (USD / 1M tokens).
 * - input  : tokens consommés en entrée
 * - output : tokens générés en sortie
 * - cacheRead  : tokens lus depuis le cache (90 % moins cher que input)
 * - cacheWrite : tokens écrits dans le cache (25 % plus cher que input)
 */
export const PRICING_USD_PER_M = {
  "claude-sonnet-4-5-20250929": {
    input: 3,
    output: 15,
    cacheRead: 0.3,
    cacheWrite: 3.75,
  },
  "claude-haiku-4-5-20251001": {
    input: 1,
    output: 5,
    cacheRead: 0.1,
    cacheWrite: 1.25,
  },
} as const satisfies Record<
  ClaudeModel,
  { input: number; output: number; cacheRead: number; cacheWrite: number }
>;

/**
 * Taux USD → EUR figé. Mai 2026 ≈ 0,92.
 * Volontairement non dynamique : pas d'appel à une API forex pour rester
 * simple et offline-friendly. L'affichage est marqué « ≈ » côté UI.
 */
export const USD_TO_EUR = 0.92;

export interface EstimateCostInput {
  model: string;
  inputTokens?: number | null;
  outputTokens?: number | null;
  cacheReadTokens?: number | null;
  cacheCreateTokens?: number | null;
}

export interface CostEstimate {
  usd: number;
  eur: number;
  breakdown: {
    input: number;
    output: number;
    cache: number;
  };
}

/**
 * Calcule un coût USD + EUR à partir des compteurs de tokens et du modèle.
 *
 * Si le modèle est inconnu (vieux message persisté avec un id renommé),
 * on retombe sur le tarif Sonnet — c'est ce qui se rapproche le plus de
 * l'usage réel du module et évite de sous-estimer.
 */
export function estimateCost({
  model,
  inputTokens,
  outputTokens,
  cacheReadTokens,
  cacheCreateTokens,
}: EstimateCostInput): CostEstimate {
  const pricing =
    (PRICING_USD_PER_M as Record<
      string,
      { input: number; output: number; cacheRead: number; cacheWrite: number }
    >)[model] ?? PRICING_USD_PER_M[CLAUDE_MODELS.sonnet];

  const input = ((inputTokens ?? 0) * pricing.input) / 1_000_000;
  const output = ((outputTokens ?? 0) * pricing.output) / 1_000_000;
  const cacheRead = ((cacheReadTokens ?? 0) * pricing.cacheRead) / 1_000_000;
  const cacheWrite = ((cacheCreateTokens ?? 0) * pricing.cacheWrite) / 1_000_000;
  const cache = cacheRead + cacheWrite;

  const usd = input + output + cache;
  const eur = usd * USD_TO_EUR;

  return {
    usd,
    eur,
    breakdown: { input, output, cache },
  };
}

/**
 * Formatte un coût en USD pour l'affichage : "$0.12", "$1.23K".
 * Adapté pour des micro-coûts (3 décimales si < 0.01).
 */
export function fmtCostUsd(usd: number): string {
  if (!isFinite(usd) || usd <= 0) return "$0.00";
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  if (usd < 1) return `$${usd.toFixed(3)}`;
  if (usd < 1000) return `$${usd.toFixed(2)}`;
  return `$${(usd / 1000).toFixed(2)}K`;
}

/**
 * Formatte un coût en EUR — même logique que `fmtCostUsd`, suffixe €.
 */
export function fmtCostEur(eur: number): string {
  if (!isFinite(eur) || eur <= 0) return "€0.00";
  if (eur < 0.01) return `€${eur.toFixed(4)}`;
  if (eur < 1) return `€${eur.toFixed(3)}`;
  if (eur < 1000) return `€${eur.toFixed(2)}`;
  return `€${(eur / 1000).toFixed(2)}K`;
}

/**
 * Formatte un nombre de tokens : "123", "1.2K", "3.4M".
 * Plus expressif que `fmtTokens` de _shared.tsx (qui ne gère pas M).
 */
export function fmtTokensCompact(n: number | null | undefined): string {
  if (n == null || !isFinite(n)) return "—";
  if (n < 1000) return `${n}`;
  if (n < 1_000_000) return `${(n / 1000).toFixed(1)}K`;
  return `${(n / 1_000_000).toFixed(2)}M`;
}

/**
 * Estime grossièrement le nombre de tokens d'un texte (4 chars / token, FR).
 * Réplique `estimateTokens` de `models.ts` ici pour ne pas créer de dépendance
 * circulaire — c'est trivial et léger.
 */
export function roughTokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}
