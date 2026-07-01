/**
 * Construction du contexte de sources injecté dans le system prompt de Claude.
 *
 * Deux stratégies disponibles :
 *
 *   A. `buildKnowledgeContext` (MVP, fallback) — récupère TOUTES les sources
 *      `enabled` du domaine, boost par mots-clés, tronque sous le budget.
 *      Coûteuse en tokens quand la KB grandit (100+ sources → 250K tokens
 *      par message).
 *
 *   B. `buildKnowledgeContextRag` (préférée depuis la migration 19) — embed
 *      la query, query pgvector pour le top-K chunks pertinents, injecte
 *      uniquement ces chunks (5-10K tokens). Cf. lib/chomage-ia/indexer.ts
 *      pour l'indexation côté écriture.
 *
 * Le caller (`prepareChatContext` dans chat-pipeline.ts) tente la B en premier
 * et retombe sur la A si :
 *   - pas de provider d'embeddings configuré
 *   - pas de chunks indexés pour ce domain
 *   - erreur transitoire (provider down, query embed échoue)
 *
 * → Le chat continue de fonctionner même si la RAG est cassée.
 */

import { prisma } from "@/lib/prisma";
import {
  KB_CONTEXT_BUDGET_TOKENS,
  estimateTokens,
} from "./models";
import {
  embedTexts,
  getEmbeddingProvider,
  vectorToSqlLiteral,
} from "./embeddings";
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
 * Visibilités qu'un viewer a le droit de voir dans le retrieval (corpus légal RioLex).
 * - "public"  : citoyens / non authentifiés → sources publiques uniquement ;
 * - "partner" : partenaires → public + partenaire ;
 * - "admin"   : admin → tout (dont commentaires internes ONEM).
 * Défaut sécurisé : `["public"]` (aucune fuite si un appelant ne précise rien).
 */
export function allowedVisibilities(
  role: "public" | "partner" | "admin",
): string[] {
  if (role === "admin") return ["public", "partner", "admin"];
  if (role === "partner") return ["public", "partner"];
  return ["public"];
}

/**
 * Construit le contexte sources à envoyer à Claude.
 * Retourne le bloc texte formaté + la liste des IDs effectivement inclus.
 *
 * @param domain          Domaine de la KB (défaut "chomage")
 * @param query           Question utilisateur (pour le ranking par mots-clés)
 * @param budget          Budget tokens max (optionnel — défaut KB_CONTEXT_BUDGET_TOKENS)
 * @param scopeFolderIds  Migration 21 — si non vide, ne considère que les sources
 *                        dont folderId ∈ scopeFolderIds (sinon toute la KB).
 */
export async function buildKnowledgeContext({
  domain,
  query,
  budget = KB_CONTEXT_BUDGET_TOKENS,
  scopeFolderIds,
  visibilities = ["public"],
}: {
  domain: string;
  query: string;
  budget?: number;
  scopeFolderIds?: string[];
  /** Visibilités autorisées pour le viewer (défaut sécurisé public). */
  visibilities?: string[];
}): Promise<{
  contextText: string;
  includedSourceIds: string[];
  totalSourcesAvailable: number;
  truncated: boolean;
}> {
  const scoped =
    Array.isArray(scopeFolderIds) && scopeFolderIds.length > 0
      ? scopeFolderIds
      : null;

  const allSources = await prisma.knowledgeSource.findMany({
    where: {
      domain,
      enabled: true,
      visibility: { in: visibilities },
      ...(scoped ? { folderId: { in: scoped } } : {}),
    },
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

/* ------------------------------------------------------------------ */
/*  RAG sémantique via pgvector (migration 19)                         */
/* ------------------------------------------------------------------ */

/** Top-K par défaut : nombre de chunks récupérés via vector search. */
export const RAG_DEFAULT_TOP_K = 8;

/** Limite haute de chunks par source pour éviter qu'une seule source domine. */
const RAG_MAX_CHUNKS_PER_SOURCE = 3;

interface RagChunkRow {
  chunk_id: string;
  source_id: string;
  chunk_index: number;
  chunk_content: string;
  source_title: string;
  source_kind: string;
  source_url: string | null;
  distance: number;
}

export interface BuildKnowledgeContextRagResult {
  /** Bloc texte à mettre dans `cachedContext`. Vide si aucun chunk pertinent. */
  contextText: string;
  /** IDs des sources injectées (déduplication des chunks → 1 ID par source). */
  includedSourceIds: string[];
  /** Mode effectif utilisé. `"rag"` = vector search OK, `"fallback"` = degraded. */
  mode: "rag" | "fallback";
  /** Détail debug : nb de chunks récupérés, modèle d'embed utilisé, etc. */
  debug: {
    chunkCount: number;
    embedModel: string | null;
    embedDim: number | null;
    fallbackReason?: string;
  };
}

/**
 * Construit le contexte RAG via vector search pgvector.
 *
 * Étapes :
 *   1. Embed la query (un seul vecteur).
 *   2. Query pgvector :
 *        SELECT chunks JOIN sources WHERE domain ET enabled ET embedding NOT NULL
 *        [ET source.folderId ∈ scopeFolderIds si fourni]
 *        ORDER BY embedding <=> queryVector  (cosine distance, ASC)
 *        LIMIT topK
 *   3. Regroupe par source, formate en blocs `[SRC:id]` lisibles.
 *
 * Si une étape échoue, on yield un `mode: "fallback"` et le caller doit
 * basculer sur `buildKnowledgeContext`. L'erreur exacte est dans `debug.fallbackReason`.
 *
 * @param domain          Domaine de la KB ("chomage" par défaut)
 * @param query           Question utilisateur — sera embeddée
 * @param topK            Nombre max de chunks à récupérer (défaut RAG_DEFAULT_TOP_K)
 * @param scopeFolderIds  Migration 21 — si non vide, ne considère que les
 *                        sources dont `folderId` ∈ scopeFolderIds.
 */
export async function buildKnowledgeContextRag({
  domain,
  query,
  topK = RAG_DEFAULT_TOP_K,
  scopeFolderIds,
  visibilities = ["public"],
}: {
  domain: string;
  query: string;
  topK?: number;
  scopeFolderIds?: string[];
  /** Visibilités autorisées pour le viewer (défaut sécurisé public). */
  visibilities?: string[];
}): Promise<BuildKnowledgeContextRagResult> {
  // 1. Pas de provider → fallback immédiat.
  if (!getEmbeddingProvider()) {
    return {
      contextText: "",
      includedSourceIds: [],
      mode: "fallback",
      debug: {
        chunkCount: 0,
        embedModel: null,
        embedDim: null,
        fallbackReason:
          "Aucun provider d'embeddings (VOYAGE_API_KEY ou OPENAI_API_KEY).",
      },
    };
  }

  const trimmedQuery = (query ?? "").trim();
  if (trimmedQuery.length === 0) {
    return {
      contextText: "",
      includedSourceIds: [],
      mode: "fallback",
      debug: {
        chunkCount: 0,
        embedModel: null,
        embedDim: null,
        fallbackReason: "Query vide.",
      },
    };
  }

  // 2. Embed la query.
  let queryVector: number[];
  let modelUsed: string;
  let dimUsed: number;
  try {
    const { vectors, model, dim } = await embedTexts([trimmedQuery]);
    if (!vectors[0] || vectors[0].length === 0) {
      throw new Error("Embedding vide");
    }
    queryVector = vectors[0];
    modelUsed = model;
    dimUsed = dim;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn("[chomage-ia rag] query embed failed:", message);
    return {
      contextText: "",
      includedSourceIds: [],
      mode: "fallback",
      debug: {
        chunkCount: 0,
        embedModel: null,
        embedDim: null,
        fallbackReason: `Échec embed query : ${message.slice(0, 200)}`,
      },
    };
  }

  // 3. Vector search via raw SQL.
  // On surcharge légèrement la limit (topK * 2) pour gérer la dédup
  // par source en JS sans risquer de manquer des sources distinctes.
  const overSampleK = Math.min(topK * 3, 50);
  const vecLit = vectorToSqlLiteral(queryVector);
  const scoped =
    Array.isArray(scopeFolderIds) && scopeFolderIds.length > 0
      ? scopeFolderIds
      : null;

  let rows: RagChunkRow[] = [];
  try {
    if (scoped) {
      // Variante scopée : on ajoute un filtre `s.folderId = ANY($4)` qui filtre
      // les sources sur les folders sélectionnés. Cf. ChatSession.scopeFolderIds.
      rows = await prisma.$queryRawUnsafe<RagChunkRow[]>(
        `SELECT
           c."id" AS chunk_id,
           c."sourceId" AS source_id,
           c."chunkIndex" AS chunk_index,
           c."content" AS chunk_content,
           s."title" AS source_title,
           s."kind" AS source_kind,
           s."sourceUrl" AS source_url,
           (c."embedding" <=> $1::vector) AS distance
         FROM "KnowledgeChunk" c
         INNER JOIN "KnowledgeSource" s ON s."id" = c."sourceId"
         WHERE s."domain" = $2
           AND s."enabled" = true
           AND c."embedding" IS NOT NULL
           AND s."visibility" = ANY($5::text[])
           AND s."folderId" = ANY($4::text[])
         ORDER BY c."embedding" <=> $1::vector ASC
         LIMIT $3`,
        vecLit,
        domain,
        overSampleK,
        scoped,
        visibilities,
      );
    } else {
      rows = await prisma.$queryRawUnsafe<RagChunkRow[]>(
        `SELECT
           c."id" AS chunk_id,
           c."sourceId" AS source_id,
           c."chunkIndex" AS chunk_index,
           c."content" AS chunk_content,
           s."title" AS source_title,
           s."kind" AS source_kind,
           s."sourceUrl" AS source_url,
           (c."embedding" <=> $1::vector) AS distance
         FROM "KnowledgeChunk" c
         INNER JOIN "KnowledgeSource" s ON s."id" = c."sourceId"
         WHERE s."domain" = $2
           AND s."enabled" = true
           AND c."embedding" IS NOT NULL
           AND s."visibility" = ANY($4::text[])
         ORDER BY c."embedding" <=> $1::vector ASC
         LIMIT $3`,
        vecLit,
        domain,
        overSampleK,
        visibilities,
      );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn("[chomage-ia rag] vector search SQL failed:", message);
    return {
      contextText: "",
      includedSourceIds: [],
      mode: "fallback",
      debug: {
        chunkCount: 0,
        embedModel: modelUsed,
        embedDim: dimUsed,
        fallbackReason: `Échec SQL vector search : ${message.slice(0, 200)}`,
      },
    };
  }

  if (rows.length === 0) {
    // Pas de chunks indexés pour ce domain — on retombe sur le fallback KB complète.
    return {
      contextText: "",
      includedSourceIds: [],
      mode: "fallback",
      debug: {
        chunkCount: 0,
        embedModel: modelUsed,
        embedDim: dimUsed,
        fallbackReason: "Aucun chunk indexé pour ce domain (KB pas encore indexée ?).",
      },
    };
  }

  // 4. Regroupe par source en limitant `RAG_MAX_CHUNKS_PER_SOURCE` chunks
  //    par source pour diversifier (éviter qu'une longue source domine).
  //    Les rows sont déjà triées par distance ASC (plus pertinent en premier).
  const grouped = new Map<
    string,
    {
      title: string;
      kind: string;
      sourceUrl: string | null;
      chunks: Array<{ index: number; content: string; distance: number }>;
    }
  >();
  let totalUsed = 0;
  for (const row of rows) {
    if (totalUsed >= topK) break;
    let group = grouped.get(row.source_id);
    if (!group) {
      group = {
        title: row.source_title,
        kind: row.source_kind,
        sourceUrl: row.source_url,
        chunks: [],
      };
      grouped.set(row.source_id, group);
    }
    if (group.chunks.length >= RAG_MAX_CHUNKS_PER_SOURCE) continue;
    group.chunks.push({
      index: row.chunk_index,
      content: row.chunk_content,
      distance: Number(row.distance) || 0,
    });
    totalUsed++;
  }

  // 5. Trie les chunks d'une même source par chunkIndex pour préserver
  //    l'ordre original du document.
  const includedIds: string[] = [];
  const blocks: string[] = [];
  for (const [sourceId, group] of grouped) {
    includedIds.push(sourceId);
    group.chunks.sort((a, b) => a.index - b.index);
    const header = [`<SOURCE id="${sourceId}" kind="${group.kind}" title="${escapeXml(group.title)}">`];
    if (group.sourceUrl) header.push(`URL : ${group.sourceUrl}`);
    header.push("");
    for (const ch of group.chunks) {
      header.push(`### Chunk ${ch.index}`);
      header.push(ch.content);
      header.push("");
    }
    header.push(`</SOURCE>`);
    blocks.push(header.join("\n"));
  }

  return {
    contextText: blocks.join("\n\n"),
    includedSourceIds: includedIds,
    mode: "rag",
    debug: {
      chunkCount: totalUsed,
      embedModel: modelUsed,
      embedDim: dimUsed,
    },
  };
}
