/**
 * POST /api/chomage-ia/sources/[id]/reindex
 *
 * Force la réindexation RAG d'une source. Utile quand :
 *   - On vient de configurer VOYAGE_API_KEY ou OPENAI_API_KEY et qu'on veut
 *     embedder la KB existante sans toucher au content.
 *   - L'admin a constaté un `indexError` sur la card et veut retenter.
 *   - On a changé de provider d'embeddings et qu'on veut re-embedder.
 *
 * Lancement synchrone (await) : la route renvoie le résultat de l'indexing
 * (counts + erreur éventuelle) pour donner un feedback explicite à l'admin.
 * Pour des indexings massifs, préférer la route `/admin/reindex-all`.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";
import { indexKnowledgeSource } from "@/lib/chomage-ia/indexer";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(_req: NextRequest, { params }: RouteContext) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const { id } = await params;
  const source = await prisma.knowledgeSource.findUnique({
    where: { id },
    select: { id: true, title: true },
  });
  if (!source) {
    return NextResponse.json({ error: "Source introuvable" }, { status: 404 });
  }

  try {
    const result = await indexKnowledgeSource(id);
    // Recharge la source pour renvoyer le status updaté (indexedAt + indexError).
    const updated = await prisma.knowledgeSource.findUnique({
      where: { id },
      select: { id: true, indexedAt: true, indexError: true },
    });
    return NextResponse.json({
      id,
      ...result,
      indexedAt: updated?.indexedAt?.toISOString() ?? null,
      indexError: updated?.indexError ?? null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[chomage-ia reindex] ${id} failed:`, err);
    return NextResponse.json(
      { error: `Indexation échouée : ${message}` },
      { status: 500 },
    );
  }
}
