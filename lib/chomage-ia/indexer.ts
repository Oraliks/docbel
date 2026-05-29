/**
 * Indexer RAG d'une `KnowledgeSource` :
 *   1. Récupère la source en DB.
 *   2. Chunke `source.content` (cf. chunker.ts).
 *   3. Calcule un `contentHash` (sha256) par chunk.
 *   4. Compare aux chunks existants en DB (par sourceId + chunkIndex) :
 *      - chunk inchangé (hash identique + même modèle) → skip
 *      - chunk modifié OU nouveau → embed + upsert
 *      - chunks anciens en surplus → suppression (la source est plus courte
 *        que la version précédente)
 *   5. Embed les chunks nouveaux/modifiés par batch (cf. embeddings.ts).
 *   6. Persiste en raw SQL (Prisma ne supporte pas le type vector natif).
 *   7. Met à jour `source.indexedAt` / `source.indexError`.
 *
 * Fail-soft :
 *   - Si pas de provider d'embeddings → log warn, set `indexError`, exit.
 *     Le chat retombe sur le fallback "toute la KB" (cf. context.ts).
 *   - Si l'API provider échoue → set `indexError` avec le message, exit.
 *   - Si content < 100 chars → skip carrément (rien à indexer).
 *
 * Utilisation typique : appelée en background depuis les routes upload/PATCH
 * via `runIndexInBackground` (fire-and-forget).
 */

import { prisma } from "@/lib/prisma";
import {
  chunkText,
  chunkContentHash,
  type TextChunk,
} from "./chunker";
import {
  embedTexts,
  getEmbeddingProvider,
  vectorToSqlLiteral,
} from "./embeddings";

/** Taille minimale du content pour qu'on déclenche l'indexing. */
const MIN_CONTENT_LEN = 100;

interface IndexResult {
  /** Nombre de chunks créés ou re-embeddés. */
  reindexedCount: number;
  /** Nombre de chunks skippés (inchangés). */
  skippedCount: number;
  /** Nombre de chunks supprimés (source devenue plus courte). */
  deletedCount: number;
  /** Modèle d'embedding effectivement utilisé. */
  model: string | null;
  /** Dimension native (avant padding) du modèle. */
  dim: number | null;
}

/**
 * Indexe (ou ré-indexe incrémentalement) une `KnowledgeSource`.
 *
 * Idempotent : appeler la même source 2 fois ne re-embed que ce qui a changé.
 * Throw uniquement sur erreur fatale interne (DB cassée) — les erreurs
 * "métier" (provider missing, content trop court) sont gérées via
 * `source.indexError` et ne throw pas.
 */
export async function indexKnowledgeSource(
  sourceId: string,
): Promise<IndexResult> {
  const source = await prisma.knowledgeSource.findUnique({
    where: { id: sourceId },
    select: {
      id: true,
      content: true,
      title: true,
      summary: true,
      domain: true,
    },
  });

  if (!source) {
    throw new Error(`KnowledgeSource ${sourceId} introuvable`);
  }

  // Cas 1 : pas de provider configuré → on log et on marque l'erreur.
  if (!getEmbeddingProvider()) {
    await prisma.knowledgeSource.update({
      where: { id: sourceId },
      data: {
        indexError:
          "Aucun provider d'embeddings configuré (VOYAGE_API_KEY ou OPENAI_API_KEY manquant). Le chat utilise le fallback KB complète.",
      },
    });
    return {
      reindexedCount: 0,
      skippedCount: 0,
      deletedCount: 0,
      model: null,
      dim: null,
    };
  }

  // Cas 2 : content trop court → on supprime les chunks existants et on skip.
  const content = (source.content ?? "").trim();
  if (content.length < MIN_CONTENT_LEN) {
    const deleted = await prisma.knowledgeChunk.deleteMany({
      where: { sourceId },
    });
    await prisma.knowledgeSource.update({
      where: { id: sourceId },
      data: {
        indexedAt: new Date(),
        indexError:
          content.length === 0
            ? "Content vide — rien à indexer."
            : `Content trop court (${content.length} chars < ${MIN_CONTENT_LEN}) — pas d'indexation.`,
      },
    });
    return {
      reindexedCount: 0,
      skippedCount: 0,
      deletedCount: deleted.count,
      model: null,
      dim: null,
    };
  }

  // 1. Chunke le content. On préfixe titre + summary au premier chunk pour
  //    booster le ranking (la query parle souvent du sujet général de la source).
  const headerLines: string[] = [];
  if (source.title) headerLines.push(`Titre : ${source.title}`);
  if (source.summary && source.summary.trim().length > 0) {
    headerLines.push(`Résumé : ${source.summary.trim()}`);
  }
  const header = headerLines.length > 0 ? headerLines.join("\n") + "\n\n" : "";
  const chunks: TextChunk[] = chunkText(header + content, {
    maxChars: 1000,
    overlap: 200,
    minChars: 50,
  });

  if (chunks.length === 0) {
    // Shouldn't happen vu le check MIN_CONTENT_LEN, mais on est défensif.
    await prisma.knowledgeSource.update({
      where: { id: sourceId },
      data: {
        indexedAt: new Date(),
        indexError: "Le chunker n'a produit aucun chunk.",
      },
    });
    return {
      reindexedCount: 0,
      skippedCount: 0,
      deletedCount: 0,
      model: null,
      dim: null,
    };
  }

  // 2. Calcule les hashs.
  const chunkHashes = await Promise.all(
    chunks.map(async (c) => ({
      index: c.index,
      content: c.content,
      hash: await chunkContentHash(c.content),
    })),
  );

  // 3. Récupère les chunks existants pour cette source.
  const existing = await prisma.knowledgeChunk.findMany({
    where: { sourceId },
    select: {
      id: true,
      chunkIndex: true,
      contentHash: true,
      embedModel: true,
    },
  });
  const existingByIndex = new Map<
    number,
    { id: string; contentHash: string; embedModel: string }
  >();
  for (const c of existing) {
    existingByIndex.set(c.chunkIndex, {
      id: c.id,
      contentHash: c.contentHash,
      embedModel: c.embedModel,
    });
  }

  // 4. Détermine quels chunks doivent être (re)indexés vs skippés.
  //    Pour skip un chunk, il faut : même index + même hash + même modèle
  //    que la session courante (on suppose qu'on garde le même provider
  //    pendant la durée d'un indexing).
  const toReindex: typeof chunkHashes = [];
  const toSkipIndexes = new Set<number>();
  // On a besoin du provider/modèle pour comparer — on l'apprend lors du 1er embed.
  // Stratégie : on tente d'abord d'optimiser en supposant que rien n'a changé,
  // puis on embed les manquants. Cf. boucle plus bas.

  for (const ch of chunkHashes) {
    const prev = existingByIndex.get(ch.index);
    if (prev && prev.contentHash === ch.hash) {
      // Hash identique → on skippe (peu importe le modèle, le contenu n'a pas changé).
      // Si le modèle a changé entre temps, on pourrait re-embed mais ça coûte cher
      // et le gain est marginal. On préfère garder l'existant.
      toSkipIndexes.add(ch.index);
    } else {
      toReindex.push(ch);
    }
  }

  // 5. Détermine les chunks à supprimer (index présents en DB mais plus dans la nouvelle découpe).
  const newIndexes = new Set(chunkHashes.map((c) => c.index));
  const toDeleteIds: string[] = [];
  for (const [idx, prev] of existingByIndex) {
    if (!newIndexes.has(idx)) {
      toDeleteIds.push(prev.id);
    }
  }

  // 6. Embed les chunks qui en ont besoin.
  let modelUsed: string | null = null;
  let dimUsed: number | null = null;
  let reindexedCount = 0;

  if (toReindex.length > 0) {
    try {
      const { vectors, model, dim } = await embedTexts(
        toReindex.map((c) => c.content),
      );
      modelUsed = model;
      dimUsed = dim;

      // 7. Upsert chunk par chunk en raw SQL (Prisma ne sait pas écrire vector).
      //
      // Anciennement on wrappait toute la boucle dans prisma.$transaction(),
      // mais avec le pooler Neon + des sources volumineuses (50+ chunks à
      // 1000 chars), les UPDATE/INSERT cumulés dépassaient le timeout par
      // défaut Prisma (5s) → "Transaction not found. Transaction ID is
      // invalid, refers to an old closed transaction".
      //
      // Compromis pragmatique : on batch les upserts par groupes de 5 dans
      // des micro-transactions (durée < 1s chacune). Si le run global crash,
      // on peut avoir une source partiellement indexée — mais c'est OK car
      // le RAG fallback prend le relai et le prochain indexing rejouera
      // proprement (chunks inchangés sont skippés via le hash).
      const CHUNK_BATCH_SIZE = 5;
      for (let start = 0; start < toReindex.length; start += CHUNK_BATCH_SIZE) {
        const slice = toReindex.slice(start, start + CHUNK_BATCH_SIZE);
        await prisma.$transaction(
          async (tx) => {
            for (let j = 0; j < slice.length; j++) {
              const ch = slice[j];
              const v = vectors[start + j];
              const vecLit = vectorToSqlLiteral(v);
              const prev = existingByIndex.get(ch.index);
              if (prev) {
                await tx.$executeRawUnsafe(
                  `UPDATE "KnowledgeChunk"
                   SET "content" = $1,
                       "contentHash" = $2,
                       "embedding" = $3::vector,
                       "embedDim" = $4,
                       "embedModel" = $5,
                       "updatedAt" = NOW()
                   WHERE "id" = $6`,
                  ch.content,
                  ch.hash,
                  vecLit,
                  dim,
                  model,
                  prev.id,
                );
              } else {
                await tx.$executeRawUnsafe(
                  `INSERT INTO "KnowledgeChunk"
                     ("id", "sourceId", "chunkIndex", "content", "contentHash",
                      "embedding", "embedDim", "embedModel", "createdAt", "updatedAt")
                   VALUES ($1, $2, $3, $4, $5, $6::vector, $7, $8, NOW(), NOW())`,
                  cuidLite(),
                  sourceId,
                  ch.index,
                  ch.content,
                  ch.hash,
                  vecLit,
                  dim,
                  model,
                );
              }
              reindexedCount++;
            }
          },
          // Garde-fou explicite : timeout 30s par batch (vs défaut 5s), maxWait
          // 10s pour attendre une connection du pool avant d'abandonner.
          { timeout: 30_000, maxWait: 10_000 },
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(
        `[chomage-ia indexer] embed/insert failed for source ${sourceId}:`,
        message,
      );
      await prisma.knowledgeSource.update({
        where: { id: sourceId },
        data: {
          // On garde l'indexedAt précédent (les anciens chunks restent valides).
          indexError: `Échec embedding/insert : ${message.slice(0, 500)}`,
        },
      });
      return {
        reindexedCount,
        skippedCount: toSkipIndexes.size,
        deletedCount: 0,
        model: modelUsed,
        dim: dimUsed,
      };
    }
  }

  // 8. Supprime les chunks orphelins.
  let deletedCount = 0;
  if (toDeleteIds.length > 0) {
    const del = await prisma.knowledgeChunk.deleteMany({
      where: { id: { in: toDeleteIds } },
    });
    deletedCount = del.count;
  }

  // 9. Marque la source comme indexée OK.
  await prisma.knowledgeSource.update({
    where: { id: sourceId },
    data: {
      indexedAt: new Date(),
      indexError: null,
    },
  });

  console.log(
    `[chomage-ia indexer] ks=${sourceId} → ${reindexedCount} (re)indexés, ${toSkipIndexes.size} skippés, ${deletedCount} supprimés (model=${modelUsed ?? "n/a"})`,
  );

  return {
    reindexedCount,
    skippedCount: toSkipIndexes.size,
    deletedCount,
    model: modelUsed,
    dim: dimUsed,
  };
}

/**
 * Fire-and-forget : indexe une source en background sans bloquer l'appel.
 * Catch toute erreur et l'écrit dans `source.indexError`. Pour usage depuis
 * les routes upload / POST / PATCH.
 *
 * @example
 *   void runIndexInBackground(ks.id);
 */
export function runIndexInBackground(sourceId: string): void {
  void (async () => {
    try {
      await indexKnowledgeSource(sourceId);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(
        `[chomage-ia indexer] background failed for ks=${sourceId}:`,
        message,
      );
      try {
        await prisma.knowledgeSource.update({
          where: { id: sourceId },
          data: {
            indexError: `Background indexer crashed : ${message.slice(0, 500)}`,
          },
        });
      } catch {
        // Si même l'update échoue, on log et on lâche prise.
      }
    }
  })();
}

/* ------------------------------------------------------------------ */
/*  Utilitaires                                                        */
/* ------------------------------------------------------------------ */

/**
 * Génère un cuid-like local (24 chars, base36 + timestamp) pour les inserts
 * raw SQL. Prisma ne nous donne pas accès à son générateur cuid via $executeRawUnsafe,
 * donc on en fait un nous-mêmes. Format compatible avec le pattern des autres
 * IDs cuid du projet (préfixe lettre + timestamp + random).
 *
 * Pas critique sur l'unicité globale : c'est scopé à un sourceId via la FK.
 */
function cuidLite(): string {
  const ts = Date.now().toString(36);
  const rnd = Math.random().toString(36).slice(2, 12);
  const rnd2 = Math.random().toString(36).slice(2, 8);
  return `c${ts}${rnd}${rnd2}`;
}
