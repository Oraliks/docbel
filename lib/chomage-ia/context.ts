/**
 * Construction du contexte de sources injecté dans le system prompt de Claude.
 *
 * Stratégie MVP — pas d'embeddings :
 *   1. Récupère toutes les sources `enabled` du domaine.
 *   2. Si la question contient des mots-clés, booste les sources qui
 *      matchent (par titre, tags, début du contenu) — naïf mais utile.
 *   3. Tronque la liste pour rester sous KB_CONTEXT_BUDGET_TOKENS.
 *   4. Formate chaque source comme un bloc `[SRC:id]` digestible.
 *
 * TODO : ajouter retrieval sémantique (embeddings + pgvector) quand la KB
 *        dépasse ~200 sources ou que les réponses deviennent imprécises.
 */

import { prisma } from "@/lib/prisma";
import {
  KB_CONTEXT_BUDGET_TOKENS,
  estimateTokens,
} from "./models";
import type { KnowledgeSource } from "@prisma/client";

interface RankedSource {
  source: KnowledgeSource;
  score: number;
}

/**
 * Normalise un texte pour le matching (lowercase, accents retirés).
 */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Score grossier d'une source par rapport à une question.
 * - +3 par mot-clé matchant dans le titre
 * - +2 par mot-clé matchant dans les tags
 * - +1 par mot-clé matchant dans les 500 premiers caractères du contenu
 */
function scoreSource(source: KnowledgeSource, queryTerms: string[]): number {
  if (queryTerms.length === 0) return 0;
  const title = normalize(source.title);
  const tags = (source.tags ?? []).map(normalize);
  const contentHead = normalize(source.content.slice(0, 500));
  let score = 0;
  for (const term of queryTerms) {
    if (title.includes(term)) score += 3;
    if (tags.some((t) => t.includes(term))) score += 2;
    if (contentHead.includes(term)) score += 1;
  }
  return score;
}

/**
 * Extrait jusqu'à 10 mots-clés pertinents d'une question utilisateur.
 * Filtre les mots-outils français les plus communs.
 */
const STOPWORDS = new Set(
  "a au aux avec ce ces cet cette dans de des du elle elles en est et eu il ils je la le les leur leurs lui ma mais me mes moi mon ne nos notre nous on ou par pas pour qu que qui sa se ses son sont sur ta tes toi ton tu un une vos votre vous y c d j l m n s t".split(
    " "
  )
);

function extractKeywords(query: string): string[] {
  return normalize(query)
    .split(" ")
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w))
    .slice(0, 10);
}

/**
 * Construit le contexte sources à envoyer à Claude.
 * Retourne le bloc texte formaté + la liste des IDs effectivement inclus.
 *
 * @param domain   Domaine de la KB (défaut "chomage")
 * @param query    Question utilisateur (pour le ranking par mots-clés)
 * @param budget   Budget tokens max (optionnel — défaut KB_CONTEXT_BUDGET_TOKENS)
 */
export async function buildKnowledgeContext({
  domain,
  query,
  budget = KB_CONTEXT_BUDGET_TOKENS,
}: {
  domain: string;
  query: string;
  budget?: number;
}): Promise<{
  contextText: string;
  includedSourceIds: string[];
  totalSourcesAvailable: number;
  truncated: boolean;
}> {
  const allSources = await prisma.knowledgeSource.findMany({
    where: { domain, enabled: true },
    orderBy: { updatedAt: "desc" },
  });

  if (allSources.length === 0) {
    return {
      contextText: "",
      includedSourceIds: [],
      totalSourcesAvailable: 0,
      truncated: false,
    };
  }

  const terms = extractKeywords(query);
  const ranked: RankedSource[] = allSources
    .map((source) => ({
      source,
      score: scoreSource(source, terms),
    }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      // À score égal, prendre les plus récentes
      return b.source.updatedAt.getTime() - a.source.updatedAt.getTime();
    });

  const blocks: string[] = [];
  const includedIds: string[] = [];
  let tokensUsed = 0;
  let truncated = false;

  for (const { source } of ranked) {
    const block = formatSourceBlock(source);
    const blockTokens = estimateTokens(block);
    if (tokensUsed + blockTokens > budget) {
      truncated = true;
      break;
    }
    blocks.push(block);
    includedIds.push(source.id);
    tokensUsed += blockTokens;
  }

  return {
    contextText: blocks.join("\n\n"),
    includedSourceIds: includedIds,
    totalSourcesAvailable: allSources.length,
    truncated,
  };
}

/**
 * Formate une source en bloc texte que Claude consomme.
 * Le marqueur `[SRC:id]` permet à Claude d'y faire référence dans sa réponse.
 */
function formatSourceBlock(source: KnowledgeSource): string {
  const header = [
    `<SOURCE id="${source.id}" kind="${source.kind}" title="${escapeXml(source.title)}">`,
  ];
  if (source.summary) {
    header.push(`Résumé : ${source.summary}`);
  }
  if (source.sourceUrl) {
    header.push(`URL : ${source.sourceUrl}`);
  }
  if ((source.tags ?? []).length > 0) {
    header.push(`Tags : ${source.tags.join(", ")}`);
  }
  header.push("");
  header.push(source.content);
  header.push(`</SOURCE>`);
  return header.join("\n");
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Extrait les IDs de sources cités dans une réponse Claude.
 * Format attendu : `[SRC:cuid123]` ou `[SOURCE:cuid123]`.
 * Retourne une liste dédupliquée et limitée à 50.
 */
export function extractCitedSourceIds(text: string): string[] {
  const ids = new Set<string>();
  const re = /\[(?:SRC|SOURCE):([a-z0-9_-]+)\]/gi;
  let match;
  while ((match = re.exec(text)) !== null) {
    ids.add(match[1]);
    if (ids.size >= 50) break;
  }
  return [...ids];
}
