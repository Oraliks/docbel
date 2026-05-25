/**
 * POST /api/chomage-ia/admin/reindex-all?domain=chomage[&onlyMissing=1]
 *
 * Lance la réindexation RAG en background pour TOUTES les sources d'un domain.
 * Renvoie immédiatement la liste des IDs queueés — les indexings tournent
 * en parallèle (fire-and-forget) côté serveur.
 *
 * Query params :
 *   - domain      : domaine ciblé (défaut "chomage")
 *   - onlyMissing : si "1", ne re-indexe que les sources où indexedAt=null
 *                   ou indexError IS NOT NULL. Évite de re-embed inutilement.
 *
 * Coût : chaque source consomme tokens du provider d'embed (Voyage ~$0.02/M).
 * Pour 100 sources × 5000 chars ≈ 125K tokens → ~$0.0025. Négligeable.
 *
 * Cap implicite : pas plus de 500 sources par run pour éviter les surcharges
 * (la KB est censée rester sous quelques centaines de sources).
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";
import { DEFAULT_DOMAIN } from "@/lib/chomage-ia/types";
import { runIndexInBackground } from "@/lib/chomage-ia/indexer";
import { getEmbeddingProvider } from "@/lib/chomage-ia/embeddings";

const MAX_SOURCES_PER_RUN = 500;

export async function POST(req: NextRequest) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const url = new URL(req.url);
  const domain = url.searchParams.get("domain") ?? DEFAULT_DOMAIN;
  const onlyMissing = url.searchParams.get("onlyMissing") === "1";

  const provider = getEmbeddingProvider();
  if (!provider) {
    return NextResponse.json(
      {
        error:
          "Aucun provider d'embeddings configuré. Définis VOYAGE_API_KEY ou OPENAI_API_KEY.",
      },
      { status: 503 },
    );
  }

  const where: Record<string, unknown> = { domain };
  if (onlyMissing) {
    where.OR = [{ indexedAt: null }, { indexError: { not: null } }];
  }

  const sources = await prisma.knowledgeSource.findMany({
    where,
    select: { id: true, title: true },
    orderBy: { updatedAt: "desc" },
    take: MAX_SOURCES_PER_RUN,
  });

  for (const s of sources) {
    runIndexInBackground(s.id);
  }

  return NextResponse.json({
    queued: sources.length,
    domain,
    onlyMissing,
    provider,
    message:
      sources.length === 0
        ? "Aucune source à indexer."
        : `Indexing lancé en background pour ${sources.length} source(s). Vérifie indexedAt / indexError sur les cards dans quelques secondes.`,
  });
}

/**
 * GET /api/chomage-ia/admin/reindex-all?domain=chomage
 *
 * Stats légères sur l'état de l'indexing : nb sources, nb indexées,
 * nb en erreur, nb sans embeddings (provider absent au moment de la création).
 * Sert à driver la pastille "X sources à indexer" côté admin.
 */
export async function GET(req: NextRequest) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const url = new URL(req.url);
  const domain = url.searchParams.get("domain") ?? DEFAULT_DOMAIN;

  const [total, indexed, withError, neverIndexed, chunkCount] =
    await Promise.all([
      prisma.knowledgeSource.count({ where: { domain } }),
      prisma.knowledgeSource.count({
        where: { domain, indexedAt: { not: null }, indexError: null },
      }),
      prisma.knowledgeSource.count({
        where: { domain, indexError: { not: null } },
      }),
      prisma.knowledgeSource.count({
        where: { domain, indexedAt: null },
      }),
      prisma.knowledgeChunk.count({
        where: { source: { domain } },
      }),
    ]);

  return NextResponse.json({
    domain,
    provider: getEmbeddingProvider(),
    total,
    indexed,
    withError,
    neverIndexed,
    chunkCount,
  });
}
