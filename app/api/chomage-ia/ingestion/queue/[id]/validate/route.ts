/**
 * POST /api/chomage-ia/ingestion/queue/[id]/validate
 *
 * Valide un IngestedDocument : crée une KnowledgeSource minimale (kind="url")
 * via `validateIngestedDocument`, puis lance indexing + auto-tag en background.
 *
 * Body optionnel : { folderId, extraTags }
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";
import { validateIngestedDocument } from "@/lib/chomage-ia/ingestion";
import { runIndexInBackground } from "@/lib/chomage-ia/indexer";
import { runAutoTagInBackground } from "@/lib/chomage-ia/auto-tag";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;
  const { id } = await params;

  let body: { folderId?: string | null; extraTags?: string[] } = {};
  try {
    body = await req.json();
  } catch {
    // body optionnel
  }

  const doc = await prisma.ingestedDocument.findUnique({
    where: { id },
    include: { ingestionSource: true },
  });
  if (!doc) {
    return NextResponse.json({ error: "Document introuvable" }, { status: 404 });
  }
  if (doc.status !== "pending") {
    return NextResponse.json(
      { error: `Document déjà ${doc.status}` },
      { status: 400 },
    );
  }

  try {
    const { knowledgeSourceId, title } = await validateIngestedDocument({
      ingestedDocumentId: id,
      domain: doc.ingestionSource.domain,
      createdById: auth.user.id,
      folderId: body.folderId ?? null,
      extraTags: body.extraTags,
    });

    // Background : auto-tag depuis le content placeholder + index RAG.
    void runAutoTagInBackground(knowledgeSourceId, title, title, []);
    runIndexInBackground(knowledgeSourceId);

    return NextResponse.json({
      ok: true,
      knowledgeSourceId,
      title,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Échec validation : ${message}` },
      { status: 500 },
    );
  }
}
