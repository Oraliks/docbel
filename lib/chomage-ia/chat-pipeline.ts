/**
 * Pipeline partagé pour les routes chat IA chômage (streaming + non-streaming).
 *
 * Factorise la logique commune entre `/api/chomage-ia/chat` et
 * `/api/chomage-ia/sessions/[id]/regenerate-from` :
 *   - Construction du `cachedContext` à partir de la KB
 *   - Détection des "missing sources" (refs légales absentes de la KB)
 *   - Validation des citations [SRC:id] effectivement émises
 *   - Récupération des CitedSourceLite pour le drawer front
 *
 * Volontairement pas couplé à Prisma session/messages : c'est aux routes de
 * persister les ChatMessage avant/après appel — la pipeline ne fait que la
 * partie "appel IA + parsing résultats".
 */

import { prisma } from "@/lib/prisma";
import {
  buildKnowledgeContext,
  buildKnowledgeContextRag,
  extractCitedSourceIds,
} from "./context";
import {
  extractLegalReferences,
  findMissingInKb,
} from "./legal-refs";

export interface PrepareChatContextResult {
  /** Bloc system de contexte à passer en `cachedContext` au wrapper Claude. */
  cachedContext: string;
  /** IDs des sources injectées dans le contexte (pour valider les citations ensuite). */
  includedSourceIds: string[];
  /** Compteur total de sources `enabled` du domaine. */
  totalSourcesAvailable: number;
  /** True si le budget tokens a forcé une troncature de la KB. */
  truncated: boolean;
  /**
   * Mode effectif utilisé pour le retrieval :
   *  - `"rag"`      : vector search pgvector (top-K chunks)
   *  - `"fallback"` : ancien comportement (toute la KB filtrée par mots-clés)
   *  - `"empty"`    : KB vide pour ce domain
   */
  retrievalMode: "rag" | "fallback" | "empty";
}

/**
 * Prépare le bloc de contexte à passer à Claude (KB serialisée) à partir
 * de la dernière question utilisateur.
 *
 * Stratégie en cascade :
 *   1. Tenter `buildKnowledgeContextRag` (vector search pgvector). Si OK,
 *      on injecte ~8 chunks de ~5K tokens — bien plus efficace qu'envoyer
 *      toute la KB.
 *   2. Si la RAG est indisponible (pas de provider, pas de chunks indexés,
 *      erreur SQL/embed), fallback sur `buildKnowledgeContext` qui envoie
 *      les sources entières.
 *
 * Le `cachedContext` est wrappé d'un préambule qui explique à Claude le
 * format des sources et la convention `[SRC:id]` à respecter.
 *
 * Migration 21 — si `scopeFolderIds` est non vide, le retrieval (RAG et
 * fallback) est restreint aux sources dont `folderId` ∈ scopeFolderIds.
 * Le préambule informe Claude que sa connaissance est volontairement scope.
 */
export async function prepareChatContext({
  domain,
  query,
  scopeFolderIds,
}: {
  domain: string;
  query: string;
  /**
   * Migration 21 — liste de KnowledgeFolder.id pour limiter la recherche.
   * `undefined` ou `[]` → toute la KB (comportement par défaut).
   */
  scopeFolderIds?: string[];
}): Promise<PrepareChatContextResult> {
  const hasScope =
    Array.isArray(scopeFolderIds) && scopeFolderIds.length > 0;

  // 1. Tentative RAG.
  let ragResult:
    | Awaited<ReturnType<typeof buildKnowledgeContextRag>>
    | null = null;
  try {
    ragResult = await buildKnowledgeContextRag({
      domain,
      query,
      scopeFolderIds,
    });
  } catch (err) {
    // Best-effort — la fonction est censée déjà catch en interne, mais on
    // double-check pour ne JAMAIS faire crasher le chat sur une erreur RAG.
    console.warn("[chomage-ia chat-pipeline] RAG threw unexpectedly:", err);
    ragResult = null;
  }

  if (ragResult && ragResult.mode === "rag" && ragResult.contextText.length > 0) {
    // Compte les sources disponibles pour les stats côté UI (KB total).
    // Si scope actif, le count reflète le sous-ensemble scopé.
    const totalAvailable = await prisma.knowledgeSource.count({
      where: {
        domain,
        enabled: true,
        ...(hasScope ? { folderId: { in: scopeFolderIds } } : {}),
      },
    });
    const scopeNotice = hasScope
      ? `\n\n⚠️ Recherche limitée à ${scopeFolderIds!.length} dossier${scopeFolderIds!.length > 1 ? "s" : ""} de la KB. Réponds uniquement avec ces extraits — si rien ne couvre la question, dis-le explicitement.`
      : "";
    const cachedContext = `Voici les passages les plus pertinents de la knowledge base, sélectionnés par recherche sémantique (top-${ragResult.debug.chunkCount} chunks).${scopeNotice}

Chaque source est encadrée par <SOURCE id="..."> ... </SOURCE> et peut contenir plusieurs chunks (### Chunk N). Cite ces IDs avec [SRC:id] dans ta réponse pour chaque affirmation factuelle. Si une info que tu connais n'est dans aucun de ces extraits, dis-le explicitement plutôt que de l'inventer.

${ragResult.contextText}`;
    return {
      cachedContext,
      includedSourceIds: ragResult.includedSourceIds,
      totalSourcesAvailable: totalAvailable,
      truncated: false,
      retrievalMode: "rag",
    };
  }

  // 2. Fallback : ancien comportement (toute la KB filtrée par mots-clés).
  if (ragResult?.debug.fallbackReason) {
    console.log(
      `[chomage-ia chat-pipeline] fallback to legacy KB: ${ragResult.debug.fallbackReason}`,
    );
  }
  const { contextText, includedSourceIds, totalSourcesAvailable, truncated } =
    await buildKnowledgeContext({ domain, query, scopeFolderIds });

  const scopeNotice = hasScope
    ? `\n\n⚠️ Recherche limitée à ${scopeFolderIds!.length} dossier${scopeFolderIds!.length > 1 ? "s" : ""} de la KB.`
    : "";
  const cachedContext = contextText
    ? `Voici les sources de la knowledge base que tu dois utiliser pour répondre.${scopeNotice}\n\nChaque source est encadrée par <SOURCE id="..."> ... </SOURCE>. Cite ces IDs avec [SRC:id] dans ta réponse pour chaque affirmation factuelle.\n\n${contextText}`
    : `(La knowledge base est vide${hasScope ? ` dans les dossiers sélectionnés` : ""} pour le domaine "${domain}". Préviens l'utilisateur que tu n'as pas de source et donne une réponse générique à vérifier.)`;

  return {
    cachedContext,
    includedSourceIds,
    totalSourcesAvailable,
    truncated,
    retrievalMode: totalSourcesAvailable === 0 ? "empty" : "fallback",
  };
}

export interface ChatPostProcessResult {
  /** IDs cités ET présents dans le contexte injecté (cross-check anti-hallucination). */
  validCitedIds: string[];
  /** Détail des sources citées (pour le drawer front). */
  citedSources: Array<{
    id: string;
    title: string;
    kind: string;
    sourceUrl: string | null;
    summary: string | null;
  }>;
  /** Refs légales mentionnées par Claude mais absentes de la KB (max 3). */
  missingSources: string[];
}

/**
 * Post-traitement d'une réponse Claude :
 *   1. Parse les marqueurs [SRC:id]
 *   2. Filtre ceux qui ne correspondent pas à une source injectée
 *   3. Hydrate les sources citées (titres, kind, URL)
 *   4. Détecte les refs légales (lois, AR, articles…) absentes de la KB
 *
 * Best-effort sur la détection "missing" : si ça échoue, on log + renvoie [].
 */
export async function postProcessChatAnswer({
  domain,
  assistantText,
  includedSourceIds,
}: {
  domain: string;
  assistantText: string;
  includedSourceIds: string[];
}): Promise<ChatPostProcessResult> {
  const allCitedIds = extractCitedSourceIds(assistantText);
  const validCitedIds = allCitedIds.filter((id) =>
    includedSourceIds.includes(id),
  );

  const citedSources =
    validCitedIds.length > 0
      ? await prisma.knowledgeSource.findMany({
          where: { id: { in: validCitedIds } },
          select: {
            id: true,
            title: true,
            kind: true,
            sourceUrl: true,
            summary: true,
          },
        })
      : [];

  let missingSources: string[] = [];
  try {
    const refs = extractLegalReferences(assistantText);
    if (refs.length > 0) {
      const corpus = await prisma.knowledgeSource.findMany({
        where: { domain, enabled: true },
        select: { title: true, content: true, tags: true },
        take: 500,
      });
      const titles = corpus.map((c) => c.title);
      const contents = corpus.map((c) => c.content.slice(0, 4000));
      const tags = corpus.flatMap((c) => c.tags);
      missingSources = findMissingInKb(refs, titles, contents, tags, 3);
    }
  } catch (err) {
    console.warn("[chomage-ia chat] missing sources detection failed:", err);
  }

  return { validCitedIds, citedSources, missingSources };
}

/**
 * Détecte si le client a demandé une réponse streaming.
 * Privilégie le header `Accept: text/event-stream`, fallback sur `?stream=1`.
 */
export function wantsStreaming(req: Request): boolean {
  const accept = req.headers.get("accept") ?? "";
  if (accept.includes("text/event-stream")) return true;
  const url = new URL(req.url);
  return url.searchParams.get("stream") === "1";
}

/**
 * Encode un payload comme un event SSE (`data: {...}\n\n`).
 * Le client doit parser ces events ligne par ligne et splitter sur `\n\n`.
 */
export function sseFormat(data: unknown): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}
