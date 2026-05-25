/**
 * Mémoire long-terme transversale (Feature 4 — migration 22).
 *
 * Faits "permanents" injectés en tête du `cachedContext` envoyé à Claude pour
 * chaque conversation : vocabulaire (ONEM = …), patterns récurrents, règles
 * de style (sources publiques uniquement), préférences user.
 *
 * Stratégie :
 *   - `buildMemoryContext({ domain })` récupère toutes les ChatMemory
 *     `enabled=true` du domain, ordonnées par importance DESC.
 *   - Budget MEMORY_BUDGET_TOKENS (~3K) — si dépassé, on tronque sur les
 *     importance "low" puis "medium".
 *   - Retourne un bloc texte formaté `## Faits permanents\n- …\n- …` que la
 *     pipeline préfixe au contexte sources avec un `cache_control ephemeral`.
 *
 * Fail-soft : retourne `""` si la table est vide ou si la requête DB échoue.
 */

import { prisma } from "@/lib/prisma";
import type { ChatMemory } from "@prisma/client";
import { estimateTokens } from "./models";

/** Importances ordonnées (premier = injecté en premier, jamais tronqué). */
export const MEMORY_IMPORTANCES = ["high", "medium", "low"] as const;
export type MemoryImportance = (typeof MEMORY_IMPORTANCES)[number];

/**
 * Budget tokens max pour le bloc memory injecté dans le system prompt.
 * Voulu petit (3K) pour ne pas concurrencer le budget sources KB (50K).
 * Si dépassé, on garde toutes les "high" puis on tronque les "medium" / "low".
 */
export const MEMORY_BUDGET_TOKENS = 3_000;

/** Importance → poids numérique pour tri DESC. */
function importanceWeight(imp: string): number {
  if (imp === "high") return 3;
  if (imp === "medium") return 2;
  return 1;
}

interface BuildMemoryContextResult {
  /** Bloc texte à injecter ("" si rien à dire). */
  contextText: string;
  /** Memories effectivement injectées (pour debug / stats). */
  includedIds: string[];
  /** Total disponible (`enabled=true`) — pour stats UI. */
  totalAvailable: number;
  /** True si une partie des memories n'a pas tenu dans le budget. */
  truncated: boolean;
}

/**
 * Construit le bloc memory à injecter dans `cachedContext` du chat IA.
 *
 * Format produit (markdown), entre repères pour Claude :
 *
 *   ## Faits permanents (n=3)
 *   *Ces faits sont stables. Tu peux les considérer comme vrais sans citation
 *   externe — ils sont validés par l'administrateur.*
 *
 *   - **[high]** ONEM = Office National de l'Emploi.
 *   - **[medium]** Le RIS est versé par le CPAS, pas l'ONEM.
 *   - **[low]** L'admin code en TypeScript / Next.js 16.
 */
export async function buildMemoryContext({
  domain,
}: {
  domain: string;
}): Promise<BuildMemoryContextResult> {
  let memories: ChatMemory[];
  try {
    memories = await prisma.chatMemory.findMany({
      where: { domain, enabled: true },
      orderBy: [{ importance: "desc" }, { updatedAt: "desc" }],
      take: 200,
    });
  } catch (err) {
    console.warn("[chomage-ia memory] DB query failed:", err);
    return {
      contextText: "",
      includedIds: [],
      totalAvailable: 0,
      truncated: false,
    };
  }

  if (memories.length === 0) {
    return {
      contextText: "",
      includedIds: [],
      totalAvailable: 0,
      truncated: false,
    };
  }

  // Tri stable : importance weight DESC, puis updatedAt DESC.
  const sorted = [...memories].sort((a, b) => {
    const wb = importanceWeight(b.importance);
    const wa = importanceWeight(a.importance);
    if (wb !== wa) return wb - wa;
    return b.updatedAt.getTime() - a.updatedAt.getTime();
  });

  const included: ChatMemory[] = [];
  const includedIds: string[] = [];
  let tokensUsed = 0;
  let truncated = false;

  // Préambule fixe — coût stable ~50 tokens.
  const preamble =
    "## Faits permanents\n*Ces faits sont stables, validés par l'administrateur. Tu peux les considérer comme vrais sans avoir besoin de les citer.*\n";
  tokensUsed += estimateTokens(preamble);

  for (const m of sorted) {
    const line = formatMemoryLine(m);
    const lineTokens = estimateTokens(line);
    if (tokensUsed + lineTokens > MEMORY_BUDGET_TOKENS) {
      truncated = true;
      // Les `high` qui ne tiennent pas → on les inclut quand même (cap dur
      // mais on ne veut pas perdre un fait critique). Les autres : skip.
      if (m.importance !== "high") continue;
    }
    included.push(m);
    includedIds.push(m.id);
    tokensUsed += lineTokens;
  }

  const lines = included.map(formatMemoryLine).join("\n");
  const contextText = `${preamble}${lines}\n`;

  return {
    contextText,
    includedIds,
    totalAvailable: memories.length,
    truncated,
  };
}

function formatMemoryLine(m: ChatMemory): string {
  // Trim + normalise les retours de ligne en espaces pour rester en 1 bullet.
  const safe = m.content.replace(/\s+/g, " ").trim();
  return `- **[${m.importance}]** ${safe}`;
}
